import assert from 'node:assert/strict';
import { after, before, mock, suite, test } from 'node:test';

import { McpClient } from '@overture-stack/arranger-mcp-client';

import { createHarness, type Harness, name, withHost, withServer } from '#testing/harness.js';
import { call, calls, say } from '#testing/scriptedProvider.js';
import { startTestServer, type TestServer } from '#testing/server.js';

import {
	assertServersApart,
	markReturnedData,
	reconcileServers,
	restrictedDataFrom,
	type ServerRecord,
} from './crossing.js';
import { holdsRestrictedData, identifyEndpoint, ServerSetError } from './crossing.js';
import { type McpHostOptions } from './options.js';
import { reduceToolName } from './registry.js';
import { emptyState } from './state.js';

const OVERTURE = 'https://overture.example.org/mcp';
const GENES = 'https://genes.example.org/mcp';

const record = (
	key: string,
	url: string,
	containsOnlyOpenData: boolean,
	returnedData: ServerRecord['returnedData'],
): ServerRecord => ({ key, ...identifyEndpoint(url), containsOnlyOpenData, returnedData });

suite('identifyEndpoint', () => {
	test('keeps only the origin readable, so a key in the path or query is never saved', () => {
		const identity = identifyEndpoint(
			'https://user:pass@mcp.example.org:8443/api/s/SECRET-KEY-123/mcp?token=abc#x',
		);
		assert.equal(identity.origin, 'https://mcp.example.org:8443');
		assert.match(identity.endpointDigest, /^[0-9a-f]{64}$/);
		assert.doesNotMatch(JSON.stringify(identity), /SECRET|abc|user|pass/);
	});

	test('tells apart URLs that differ by path or query, and ignores user info and fragment', () => {
		const base = identifyEndpoint('https://mcp.example.org/mcp?study=A').endpointDigest;
		assert.notEqual(identifyEndpoint('https://mcp.example.org/mcp?study=B').endpointDigest, base);
		assert.notEqual(identifyEndpoint('https://mcp.example.org/other?study=A').endpointDigest, base);
		assert.equal(identifyEndpoint('https://someone@mcp.example.org/mcp?study=A#top').endpointDigest, base);
	});

	test('refuses what is not a URL', () => {
		assert.throws(() => identifyEndpoint('not a url'), TypeError);
	});
});

suite('returned data', () => {
	test("records whether a server's data may cross, and never lowers it", () => {
		const server = record('s', GENES, true, 'none');
		markReturnedData(server);
		assert.equal(server.returnedData, 'unrestricted');

		server.containsOnlyOpenData = false;
		markReturnedData(server);
		assert.equal(server.returnedData, 'restricted');

		server.containsOnlyOpenData = true;
		markReturnedData(server);
		assert.equal(server.returnedData, 'restricted');
	});

	test('a conversation holds restricted data once an unflagged server has returned some', () => {
		assert.equal(holdsRestrictedData([record('s', GENES, false, 'none')]), false);
		assert.equal(holdsRestrictedData([record('s', GENES, true, 'unrestricted')]), false);
		assert.equal(holdsRestrictedData([record('s', GENES, false, 'restricted')]), true);
	});

	test("a call carries restricted data out only when another server's data is restricted", () => {
		const servers = [record('overture', OVERTURE, false, 'restricted'), record('genes', GENES, true, 'none')];

		assert.deepEqual(restrictedDataFrom(servers, 'overture'), [], 'its own follow-up');
		assert.deepEqual(restrictedDataFrom(servers, 'genes'), ['overture']);
		assert.deepEqual(
			restrictedDataFrom(
				[record('overture', OVERTURE, false, 'none'), record('genes', GENES, true, 'unrestricted')],
				'overture',
			),
			[],
		);
	});
});

suite('assertServersApart', () => {
	const configured = (key: string, url: string, containsOnlyOpenData: boolean) => ({
		key,
		...identifyEndpoint(url),
		containsOnlyOpenData,
	});

	test('accepts one unflagged server alone, or any number of flagged ones', () => {
		assertServersApart([configured('overture', OVERTURE, false)], []);
		assertServersApart([configured('overture', OVERTURE, true), configured('genes', GENES, true)], []);
		assertServersApart([], []);
	});

	test('refuses an unflagged server beside any other, flagged or not', () => {
		for (const genesFlagged of [true, false]) {
			assert.throws(
				() =>
					assertServersApart(
						[configured('genes', GENES, genesFlagged), configured('overture', OVERTURE, false)],
						[],
					),
				(error) => error instanceof ServerSetError && /"(overture|genes)" is not flagged/.test(error.message),
			);
		}
	});

	test("keeps every other server out once one server's data is restricted, even with every flag on", () => {
		const held = [record('overture', OVERTURE, true, 'restricted'), record('genes', GENES, true, 'none')];

		assertServersApart([configured('overture', OVERTURE, true)], held);
		assert.throws(
			() => assertServersApart([configured('overture', OVERTURE, true), configured('genes', GENES, true)], held),
			(error) =>
				error instanceof ServerSetError &&
				error.message ===
					'Server "genes" cannot join a conversation holding restricted data from server "overture"',
		);
		assert.throws(
			() => assertServersApart([configured('genes', GENES, true)], held),
			ServerSetError,
			'a dropped server still keeps others out',
		);
	});
});

suite('reconcileServers', () => {
	const restricted = {
		servers: [record('overture', OVERTURE, false, 'restricted'), record('genes', GENES, true, 'unrestricted')],
		carried: [],
	};

	test('refuses to add any server, flagged or not, to a conversation holding restricted data', () => {
		for (const containsOnlyOpenData of [false, true]) {
			assert.throws(
				() =>
					reconcileServers(restricted, [
						{
							key: 'cbioportal',
							...identifyEndpoint('https://cbio.example.org/mcp'),
							containsOnlyOpenData,
						},
					]),
				(error: unknown) => error instanceof ServerSetError && /cbioportal/.test(error.message),
			);
		}
	});

	test('refuses to add a server to a conversation holding carried content, even with no restricted data', () => {
		const carried = {
			servers: [record('genes', GENES, true, 'none')],
			carried: [{ from: { server: 'overture' }, carriedAt: '2026-10-27T10:00:00.000Z' }],
		};
		assert.throws(
			() =>
				reconcileServers(carried, [
					{ key: 'genes', ...identifyEndpoint(GENES), containsOnlyOpenData: true },
					{ key: 'other', ...identifyEndpoint('https://other.example.org/mcp'), containsOnlyOpenData: true },
				]),
			ServerSetError,
		);
	});

	test('treats a key that now reaches another endpoint as a server added', () => {
		assert.throws(
			() =>
				reconcileServers(restricted, [
					{
						key: 'overture',
						...identifyEndpoint('https://elsewhere.example.org/mcp'),
						containsOnlyOpenData: false,
					},
				]),
			(error: unknown) => error instanceof ServerSetError && /elsewhere/.test(error.message),
		);
	});

	test('treats a key whose URL differs only by query, such as another study, as a server added', () => {
		const study = {
			servers: [record('cat', 'https://mcp.example.org/mcp?study=A', false, 'restricted')],
			carried: [],
		};
		assert.throws(
			() =>
				reconcileServers(study, [
					{
						key: 'cat',
						...identifyEndpoint('https://mcp.example.org/mcp?study=B'),
						containsOnlyOpenData: false,
					},
				]),
			(error: unknown) =>
				error instanceof ServerSetError &&
				!/study/.test(error.message) &&
				/mcp\.example\.org/.test(error.message),
		);
	});

	test('lets an open conversation reuse a key for another server, with a fresh record', () => {
		const open = { servers: [record('genes', GENES, true, 'unrestricted')], carried: [] };
		const elsewhere = 'https://genes-mirror.example.org/mcp';
		assert.deepEqual(
			reconcileServers(open, [{ key: 'genes', ...identifyEndpoint(elsewhere), containsOnlyOpenData: false }]),
			[record('genes', elsewhere, false, 'none')],
		);
	});

	test('never loosens: flagging a server later keeps its earlier data restricted', () => {
		assert.deepEqual(
			reconcileServers(restricted, [
				{ key: 'overture', ...identifyEndpoint(OVERTURE), containsOnlyOpenData: true },
			]),
			[record('overture', OVERTURE, true, 'restricted'), record('genes', GENES, true, 'unrestricted')],
		);
	});

	test('fails closed: unflagging a server makes its earlier data restricted', () => {
		const open = { servers: [record('genes', GENES, true, 'unrestricted')], carried: [] };
		const records = reconcileServers(open, [
			{ key: 'genes', ...identifyEndpoint(GENES), containsOnlyOpenData: false },
		]);
		assert.deepEqual(records, [record('genes', GENES, false, 'restricted')]);
		assert.equal(holdsRestrictedData(records), true);
	});

	test('lets a restore drop servers, and keeps their records, since their data is still in the conversation', () => {
		const records = reconcileServers(restricted, [
			{ key: 'genes', ...identifyEndpoint(GENES), containsOnlyOpenData: true },
		]);
		assert.deepEqual(records, restricted.servers);
		assert.equal(holdsRestrictedData(records), true);
	});

	test('lets a conversation holding only unrestricted data gain a server', () => {
		const open = { servers: [record('genes', GENES, true, 'unrestricted')], carried: [] };
		assert.deepEqual(
			reconcileServers(open, [
				{ key: 'genes', ...identifyEndpoint(GENES), containsOnlyOpenData: true },
				{ key: 'overture', ...identifyEndpoint(OVERTURE), containsOnlyOpenData: false },
			]),
			[record('genes', GENES, true, 'unrestricted'), record('overture', OVERTURE, false, 'none')],
		);
	});
});

suite('McpHost', () => {
	let server: TestServer;

	before(async () => {
		server = await startTestServer({ instructions: 'Use lookup for items.' });
	});

	after(async () => {
		await server.close();
	});

	suite('data crossing', () => {
		/** A saved conversation whose one server, `test`, returned restricted data. */
		const restrictedState = () => {
			const state = emptyState([{ key: 'test', ...identifyEndpoint(server.url), containsOnlyOpenData: false }]);
			return { ...state, servers: [{ ...state.servers[0], returnedData: 'restricted' }] };
		};

		/** A harness whose one server the person attests holds only open-access data. */
		const openData = (harness: Harness) => {
			harness.options.servers = [
				{ key: 'test', trusted: true, containsOnlyOpenData: true, connection: { url: server.url } },
			];
		};

		/** `test` and `other`, both on the test server, flagged as given. */
		const both = (testFlagged: boolean, otherFlagged: boolean): McpHostOptions['servers'] => [
			{ key: 'test', containsOnlyOpenData: testFlagged, connection: { url: server.url } },
			{ key: 'other', containsOnlyOpenData: otherFlagged, connection: { url: server.url } },
		];

		test('treats a server as restricted unless the person flags it', async () => {
			const harness = createHarness(server, [calls(call(name('lookup'), { id: '1' })), say('ok')]);
			await withHost(harness, async (host) => {
				assert.equal(host.state().servers[0]?.returnedData, 'none');
				await host.run({ message: 'go' });

				assert.deepEqual(host.state().servers, [
					{
						key: 'test',
						...identifyEndpoint(server.url),
						containsOnlyOpenData: false,
						returnedData: 'restricted',
					},
				]);
				assert.deepEqual(host.state().calls, [
					{ callId: 'call-1', server: 'test', tool: 'lookup', containsOnlyOpenData: false },
				]);
				assert.equal(holdsRestrictedData(host.state().servers), true);
				assert.equal(harness.of('run_started')[0]?.servers[0]?.containsOnlyOpenData, false);
			});
		});

		test("records a flagged server's data as unrestricted", async () => {
			const harness = createHarness(server, [calls(call(name('lookup'), { id: '1' })), say('ok')]);
			openData(harness);
			await withHost(harness, async (host) => {
				await host.run({ message: 'go' });

				assert.equal(host.state().servers[0]?.returnedData, 'unrestricted');
				assert.equal(holdsRestrictedData(host.state().servers), false);
				assert.equal(harness.of('run_started')[0]?.servers[0]?.containsOnlyOpenData, true);
			});
		});

		test("marks returned data only for outcomes that carry the server's text", async () => {
			const cases: [string, 'none' | 'restricted'][] = [
				[name('fails'), 'restricted'],
				[name('asks_sampling'), 'restricted'],
				[name('bad_output'), 'none'],
				[name('no_such_tool'), 'none'],
			];
			for (const [tool, expected] of cases) {
				const harness = createHarness(server, [calls(call(tool)), say('ok')]);
				await withHost(harness, async (host) => {
					await host.run({ message: 'go' });
					assert.equal(host.state().servers[0]?.returnedData, expected, tool);
				});
			}
		});

		test('marks a fetched prompt as returned data', async () => {
			const harness = createHarness(server, [say('ok')]);
			await withHost(harness, async (host) => {
				await host.run({ prompt: { server: 'test', name: 'start', arguments: { topic: 'x' } } });
				assert.equal(host.state().servers[0]?.returnedData, 'restricted');
			});
		});

		test('refuses an unflagged server beside any other, before connecting anything', async () => {
			const connects = mock.method(McpClient, 'connect');
			try {
				const flags: [boolean, boolean][] = [
					[false, true],
					[true, false],
					[false, false],
				];
				for (const [testFlagged, otherFlagged] of flags) {
					const harness = createHarness(server, [], { servers: both(testFlagged, otherFlagged) });
					await assert.rejects(harness.create(), (error) => error instanceof ServerSetError);
				}
				assert.equal(connects.mock.callCount(), 0);
			} finally {
				connects.mock.restore();
			}
		});

		test('lets flagged servers share a conversation, and call each other with what they returned', async () => {
			const harness = createHarness(
				server,
				[
					calls(call(name('lookup'), { id: '1' }), call(reduceToolName('other', 'lookup'), { id: '1' })),
					say('ok'),
				],
				{ servers: both(true, true) },
			);
			await withHost(harness, async (host) => {
				await host.run({ message: 'go' });
				assert.deepEqual(
					harness.of('tool_result').map(({ outcome }) => outcome.outcome),
					['result', 'result'],
				);
			});
		});

		test('refuses to bring a server back beside another whose data is now restricted, before connecting', async () => {
			// Both flagged, `test` returns data; a restore with `test` alone and unflagged makes that data restricted.
			// A restore with both flagged again would hold `other`, which every call to it would cross to.
			const first = createHarness(server, [calls(call(name('lookup'), { id: '1' })), say('ok')], {
				servers: both(true, true),
			});
			let saved: unknown;
			await withHost(first, async (host) => {
				await host.run({ message: 'go' });
				saved = JSON.parse(JSON.stringify(host.state()));
			});
			const unflagged = createHarness(server, [], {
				state: saved,
				servers: [{ key: 'test', connection: { url: server.url } }],
			});
			await withHost(unflagged, async (host) => {
				saved = JSON.parse(JSON.stringify(host.state()));
			});

			const connects = mock.method(McpClient, 'connect');
			try {
				const harness = createHarness(server, [], { state: saved, servers: both(true, true) });
				await assert.rejects(
					harness.create(),
					(error) =>
						error instanceof ServerSetError &&
						error.message ===
							'Server "other" cannot join a conversation holding restricted data from server "test"',
				);
				assert.equal(connects.mock.callCount(), 0);
			} finally {
				connects.mock.restore();
			}

			const alone = createHarness(server, [calls(call(name('lookup'), { id: '2' })), say('ok')], {
				state: saved,
				servers: both(true, true).slice(0, 1),
			});
			await withHost(alone, async (host) => {
				await host.run({ message: 'again' });
				assert.equal(alone.of('tool_result')[0]?.outcome.outcome, 'result', "the data's own server still runs");
			});
		});

		test('refuses to restore a conversation holding restricted data with a server added', async () => {
			const harness = createHarness(server, [], { state: restrictedState(), servers: both(true, true) });
			await assert.rejects(
				harness.create(),
				(error) => error instanceof ServerSetError && /cannot join/.test(error.message),
			);
		});

		test('never loosens on restore: flagging a server later leaves its earlier data restricted', async () => {
			const saved = restrictedState();
			const harness = createHarness(server, [], { state: saved });
			openData(harness);
			await withHost(harness, async (host) => {
				assert.deepEqual(host.state().servers, [
					{
						key: 'test',
						...identifyEndpoint(server.url),
						containsOnlyOpenData: true,
						returnedData: 'restricted',
					},
				]);
			});
		});

		test('refuses a flag that is not a boolean, rather than reading it as truthy', async () => {
			const harness = createHarness(server, [], {
				servers: [{ key: 'test', containsOnlyOpenData: 'yes', connection: { url: server.url } } as never],
			});
			await assert.rejects(harness.create(), TypeError);
		});

		test('denied, cancelled and failed calls mark nothing as returned', async () => {
			const cases: [string, Partial<McpHostOptions>, (failing: TestServer) => void][] = [
				['denied', { approvalPolicy: () => 'deny' }, () => undefined],
				['transport_error', {}, (failing) => (failing.state.failMethod = 'tools/call')],
			];
			for (const [label, overrides, arrange] of cases) {
				await withServer({}, async (failing) => {
					const harness = createHarness(
						failing,
						[calls(call(name('lookup'), { id: '1' })), say('ok')],
						overrides,
					);
					await withHost(harness, async (host) => {
						arrange(failing);
						await host.run({ message: 'go' });
						assert.equal(host.state().servers[0]?.returnedData, 'none', label);
					});
				});
			}

			const cancelling = createHarness(server, [calls(call(name('slow')))]);
			const controller = new AbortController();
			cancelling.on((event) => {
				if (event.type === 'tool_call') {
					setTimeout(() => controller.abort(), 50);
				}
			});
			await withHost(cancelling, async (host) => {
				await host.run({ message: 'go' }, { signal: controller.signal });
				assert.equal(host.state().servers[0]?.returnedData, 'none', 'cancelled');
			});
		});

		test('records what the person carried in, and refuses to restore it with a server added', async () => {
			const first = createHarness(server, [say('ok')]);
			let saved: unknown;
			await withHost(first, async (host) => {
				await host.run({
					message: 'Look these up',
					carried: {
						text: 'DO-1234 TP53',
						from: { server: 'overture' },
						carriedAt: '2026-10-27T10:00:00.000Z',
					},
				});
				assert.deepEqual(host.state().carried, [
					{ from: { server: 'overture' }, carriedAt: '2026-10-27T10:00:00.000Z' },
				]);
				saved = JSON.parse(JSON.stringify(host.state()));
			});

			const widened = createHarness(server, [], { state: saved, servers: both(true, true) });
			await assert.rejects(
				widened.create(),
				(error) => error instanceof ServerSetError && /carried content/.test(error.message),
			);
		});

		test('treats a key reused for another server as a server added', () =>
			withServer({}, async (other) => {
				const moved = createHarness(server, [], {
					state: restrictedState(),
					servers: [{ key: 'test', connection: { url: other.url } }],
				});
				await assert.rejects(moved.create(), ServerSetError);

				const open = emptyState([
					{ key: 'test', ...identifyEndpoint(server.url), containsOnlyOpenData: false },
				]);
				const reused = createHarness(other, [], {
					state: open,
					servers: [{ key: 'test', connection: { url: other.url } }],
				});
				await withHost(reused, async (host) => {
					assert.equal(host.state().servers[0]?.endpointDigest, identifyEndpoint(other.url).endpointDigest);
				});
			}));
	});
});
