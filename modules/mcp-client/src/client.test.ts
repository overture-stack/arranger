import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';

import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

import { startTestServer, type TestServer, type TestServerOptions } from '#testing/server.js';

import {
	assertCredentialTransport,
	McpClient,
	type McpClientOptions,
	PROTOCOL_REVISION,
	ReconnectRequiredError,
	type SurfaceChange,
	type SurfaceRecord,
} from './client.js';
import { type InputQuestion, type InputResolver, type RoundInfo } from './types.js';

const accept: InputResolver = async () => ({ action: 'accept', content: { confirm: true } });

const connect = (server: TestServer, options: Partial<McpClientOptions> = {}) =>
	McpClient.connect({ url: server.url, clientInfo: { name: 'mcp-client-test', version: '0.0.0' }, ...options });

/** How many `tools/call` legs the server has received. */
const toolLegs = (server: TestServer) => server.requests.filter(({ method }) => method === 'tools/call').length;

/** Runs a test against its own server, closed however the test ends. */
const withServer = async (options: TestServerOptions, test: (server: TestServer) => Promise<void>) => {
	const server = await startTestServer(options);
	try {
		await test(server);
	} finally {
		await server.close();
	}
};

const until = async (check: () => boolean, timeoutMs = 2_000) => {
	const deadline = Date.now() + timeoutMs;
	while (!check()) {
		if (Date.now() > deadline) {
			assert.fail('condition not met in time');
		}
		await sleep(20);
	}
};

suite('McpClient against an in-process server', () => {
	let server: TestServer;
	let client: McpClient;

	before(async () => {
		server = await startTestServer();
		client = await connect(server, { inputResolver: accept });
	});

	after(async () => {
		await client.close();
		await server.close();
	});

	suite('confirmation rounds', () => {
		test('answers a question and echoes the round state, which the server verifies', async () => {
			const rounds: RoundInfo[] = [];
			const questions: InputQuestion[] = [];
			const asking = await connect(server, {
				inputResolver: async (question) => {
					questions.push(question);
					return { action: 'accept', content: { confirm: true } };
				},
			});

			const outcome = await asking.callTool('call-1', 'confirm', {}, { onRound: (round) => rounds.push(round) });
			await asking.close();

			assert.equal(outcome.outcome, 'result');
			assert.deepEqual(outcome.result.content, [{ type: 'text', text: 'ran' }]);
			assert.equal(outcome.rounds, 1);
			assert.equal(rounds.length, 1);
			assert.equal(rounds[0]?.callId, 'call-1');
			assert.deepEqual(rounds[0]?.keys, ['confirm']);
			assert.equal(typeof rounds[0]?.requestState, 'string');
			assert.equal(questions[0]?.questionId, 'call-1/1/confirm');
			assert.equal(questions[0]?.message, 'Run it?');
			assert.ok(server.executed.includes('confirm'));
		});

		test('passes a declined answer to the server', async () => {
			const declining = await connect(server, { inputResolver: async () => ({ action: 'decline' }) });
			const before = server.executed.length;

			const outcome = await declining.callTool('call-2', 'confirm');
			await declining.close();

			assert.equal(outcome.outcome, 'result');
			assert.deepEqual(outcome.result.content, [{ type: 'text', text: 'declined' }]);
			assert.equal(server.executed.length, before);
		});

		test('resends rounds with no questions, counting each one', async () => {
			const rounds: RoundInfo[] = [];
			let asked = 0;
			const counting = await connect(server, {
				inputResolver: async () => {
					asked += 1;
					return { action: 'accept' };
				},
			});

			const outcome = await counting.callTool(
				'call-3',
				'state_only',
				{},
				{ onRound: (round) => rounds.push(round) },
			);
			await counting.close();

			assert.equal(outcome.outcome, 'result');
			assert.deepEqual(outcome.result.content, [{ type: 'text', text: 'after 2 rounds' }]);
			assert.equal(outcome.rounds, 2);
			assert.deepEqual(
				rounds.map(({ round, keys }) => ({ round, keys })),
				[
					{ round: 1, keys: [] },
					{ round: 2, keys: [] },
				],
			);
			assert.equal(asked, 0);
			assert.equal(outcome.waitingMs, 0);
			assert.ok(outcome.wireMs >= 500, `two 250 ms pauses count as wire time, got ${outcome.wireMs}`);
		});

		test('drives input_required on prompts/get', async () => {
			const outcome = await client.getPrompt('call-4', 'confirm_prompt', { topic: 'cats' });

			assert.equal(outcome.outcome, 'result');
			assert.equal(outcome.rounds, 1);
			assert.deepEqual(outcome.result.messages, [
				{ role: 'user', content: { type: 'text', text: 'About cats' } },
			]);
		});

		test('drives input_required on resources/read', async () => {
			const outcome = await client.readResource('call-4b', 'test://confirm');

			assert.equal(outcome.outcome, 'result');
			assert.equal(outcome.rounds, 1);
			assert.deepEqual(outcome.result.contents, [{ uri: 'test://confirm', text: 'confirmed contents' }]);
		});

		test('reads a resource from a template', async () => {
			const outcome = await client.readResource('call-4c', 'test://items/7');

			assert.equal(outcome.outcome, 'result');
			assert.deepEqual(outcome.result.contents, [{ uri: 'test://items/7', text: 'item 7' }]);
		});
	});

	suite('rounds_exceeded', () => {
		test('stops after maxRounds retries', async () => {
			let asked = 0;
			const limited = await connect(server, {
				maxRounds: 2,
				inputResolver: async () => {
					asked += 1;
					return { action: 'accept', content: { confirm: true } };
				},
			});
			const before = toolLegs(server);

			const outcome = await limited.callTool('call-5', 'always_asks');
			await limited.close();

			assert.equal(outcome.outcome, 'rounds_exceeded');
			assert.equal(outcome.maxRounds, 2);
			assert.equal(outcome.rounds, 3);
			assert.equal(asked, 2);
			assert.equal(toolLegs(server) - before, 3, 'the original request and two retries');
		});

		test('allows ten retries by default, as the SDK does', async () => {
			const before = toolLegs(server);

			const outcome = await client.callTool('call-6', 'always_asks');

			assert.equal(outcome.outcome, 'rounds_exceeded');
			assert.equal(outcome.maxRounds, 10);
			assert.equal(toolLegs(server) - before, 11);
		});
	});

	suite('cancellation', () => {
		test('reports an abort in flight as cancelled, and the server sees it', async () => {
			const controller = new AbortController();
			setTimeout(() => controller.abort(), 200);

			const outcome = await client.callTool('call-7', 'slow', {}, { signal: controller.signal });

			assert.equal(outcome.outcome, 'cancelled');
			await until(() => server.probes.at(-1)?.aborted === true);
		});

		test('reports an abort while waiting on the resolver as cancelled, and sends no retry', async () => {
			const controller = new AbortController();
			const waiting = await connect(server, {
				inputResolver: ({ signal }) =>
					new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason))),
			});
			const before = toolLegs(server);
			setTimeout(() => controller.abort(), 100);

			const outcome = await waiting.callTool('call-8', 'confirm', {}, { signal: controller.signal });
			await waiting.close();

			assert.equal(outcome.outcome, 'cancelled');
			assert.equal(toolLegs(server) - before, 1);
			assert.ok(outcome.waitingMs >= 50, `waiting time recorded, got ${outcome.waitingMs}`);
		});

		test('reports a leg timeout as a transport error, not a cancellation', async () => {
			const impatient = await connect(server, { requestTimeoutMs: 200 });

			const outcome = await impatient.callTool('call-9', 'slow');
			await impatient.close();

			assert.equal(outcome.outcome, 'transport_error');
			assert.equal(outcome.kind, 'timeout');
		});
	});

	suite('output validation', () => {
		test('reports structured content that fails the declared output schema', async () => {
			const outcome = await client.callTool('call-10', 'bad_output');

			assert.equal(outcome.outcome, 'output_invalid');
			assert.match(outcome.message, /output schema/);
			assert.deepEqual(outcome.result.structuredContent, { count: 'not a number' });
		});

		test('does not check an error result', async () => {
			const outcome = await client.callTool('call-11', 'error_without_output');

			assert.equal(outcome.outcome, 'result');
			assert.equal(outcome.result.isError, true);
		});
	});

	suite('other outcomes', () => {
		test('reports a JSON-RPC error as rejected', async () => {
			const outcome = await client.callTool('call-12', 'no_such_tool');

			assert.equal(outcome.outcome, 'rejected');
			assert.equal(outcome.code, -32602);
		});

		test('is refused by the server when asked for a capability it never declared', async () => {
			const outcome = await client.callTool('call-13', 'asks_sampling');

			assert.equal(outcome.outcome, 'rejected');
			assert.equal(outcome.code, -32021);
		});

		test('reports a resolver that throws as input_failed, and the call does not run', async () => {
			const failing = await connect(server, {
				inputResolver: async () => {
					throw new Error('the dialog crashed');
				},
			});
			const before = server.executed.length;

			const outcome = await failing.callTool('call-14', 'confirm');
			await failing.close();

			assert.equal(outcome.outcome, 'input_failed');
			assert.equal(outcome.reason, 'resolver_error');
			assert.equal(outcome.message, 'the dialog crashed');
			assert.equal(server.executed.length, before);
		});

		test('reports an onRound that throws as input_failed', async () => {
			const outcome = await client.callTool(
				'call-15',
				'confirm',
				{},
				{
					onRound: () => {
						throw new Error('could not record the round');
					},
				},
			);

			assert.equal(outcome.outcome, 'input_failed');
			assert.equal(outcome.reason, 'resolver_error');
		});

		test('sends static headers with every request', async () => {
			const authed = await connect(server, { auth: { headers: { 'x-test-auth': 'token-1' } } });
			const before = server.requests.length;

			await authed.callTool('call-16', 'error_without_output');
			await authed.close();

			const sent = server.requests.slice(before);
			assert.ok(sent.length > 0);
			assert.ok(sent.every(({ headers }) => headers['x-test-auth'] === 'token-1'));
		});
	});
});

suite('refused request state', () => {
	test('reports a state that expired while the question waited', () =>
		withServer({ ttlSeconds: 1 }, async (server) => {
			const slowToAnswer = await connect(server, {
				inputResolver: async () => {
					await sleep(2_100);
					return { action: 'accept', content: { confirm: true } };
				},
			});

			const outcome = await slowToAnswer.callTool('call-17', 'confirm');
			await slowToAnswer.close();

			assert.equal(outcome.outcome, 'input_state_rejected');
			assert.ok(outcome.waitedMs >= 2_000, `waited ${outcome.waitedMs}`);
			assert.deepEqual(server.executed, []);
		}));
});

suite('transport errors', () => {
	test('reports a server that has gone away', () =>
		withServer({}, async (server) => {
			const client = await connect(server);
			await server.close();

			const outcome = await client.callTool('call-18', 'confirm');
			await client.close();

			assert.equal(outcome.outcome, 'transport_error');
			assert.equal(outcome.kind, 'network');
		}));
});

suite('surface', () => {
	test('re-reads past the response cache', () =>
		withServer({ listTtlMs: 60_000 }, async (server) => {
			const client = await connect(server);
			const raw = new Client(
				{ name: 'raw-sdk-client', version: '0.0.0' },
				{ versionNegotiation: { mode: { pin: PROTOCOL_REVISION } } },
			);
			await raw.connect(new StreamableHTTPClientTransport(new URL(server.url)));
			await raw.listTools();
			const before = client.surface;

			server.state.extraTools.push('added_later');
			const cached = await raw.listTools();
			const refreshed = await client.refreshSurface();
			await raw.close();
			await client.close();

			assert.ok(!cached.tools.some(({ name }) => name === 'added_later'), 'the SDK serves its cached list');
			assert.ok(refreshed.snapshot.tools.some(({ name }) => name === 'added_later'));
			assert.notEqual(refreshed.hash, before.hash);
		}));

	test('has a hash unchanged by the server version, cache fields or result-level _meta', async () => {
		const surfaceOf = async (options: TestServerOptions) => {
			let surface: SurfaceRecord | undefined;
			await withServer(options, async (server) => {
				const client = await connect(server);
				surface = client.surface;
				await client.close();
			});
			return surface;
		};

		const a = await surfaceOf({ version: '1.0.0' });
		const b = await surfaceOf({ version: '2.0.0', listTtlMs: 60_000 });
		const c = await surfaceOf({ version: '1.0.0', instructions: 'Use the tools carefully.' });

		assert.equal(a?.server?.version, '1.0.0');
		assert.equal(b?.server?.version, '2.0.0');
		assert.equal(a?.hash, b?.hash);
		assert.notEqual(a?.hash, c?.hash, 'instructions are part of the surface');
		assert.equal(c?.snapshot.instructions, 'Use the tools carefully.');
	});

	test('records the server version a redeploy reports', () =>
		withServer({ version: '1.0.0' }, async (server) => {
			const client = await connect(server);
			server.state.version = '1.1.0';
			const refreshed = await client.refreshSurface();
			await client.close();

			assert.equal(refreshed.server?.version, '1.1.0');
			assert.equal(client.surface.server?.version, '1.1.0');
		}));

	test('asks for a reconnect when a redeploy advertises a new list', () =>
		withServer({}, async (server) => {
			server.state.prompts = false;
			const client = await connect(server);
			const before = client.surface;
			server.state.prompts = true;

			await assert.rejects(client.refreshSurface(), (error: unknown) => {
				assert.ok(error instanceof ReconnectRequiredError);
				assert.deepEqual(error.kinds, ['prompts']);
				return true;
			});
			await client.close();

			assert.equal(client.surface, before, 'the previous snapshot is kept');
		}));

	test('reports list changes once opted in', () =>
		withServer({}, async (server) => {
			const changes: SurfaceChange[] = [];
			const client = await connect(server, {
				changeNotifications: { onChange: (change) => changes.push(change) },
			});
			try {
				// The listen stream opens in the background. The SDK debounces changes for 300 ms, so notify once.
				await until(() => server.requests.some(({ method }) => method === 'subscriptions/listen'));
				await sleep(100);
				server.notify.toolsChanged();
				await until(() => changes.length > 0);

				assert.deepEqual(changes, [{ kind: 'tools' }]);
			} finally {
				await client.close();
			}
		}));

	test('opens no listen stream by default', () =>
		withServer({}, async (server) => {
			const client = await connect(server);
			await client.callTool('call-19', 'error_without_output');
			await client.close();

			assert.ok(server.requests.length > 0);
			assert.ok(!server.requests.some(({ method }) => method === 'subscriptions/listen'));
		}));

	test('records resources and resource templates', () =>
		withServer({}, async (server) => {
			const client = await connect(server);
			const { snapshot } = client.surface;
			await client.close();

			assert.deepEqual(
				snapshot.resources.map(({ uri }) => uri),
				['test://confirm'],
			);
			assert.deepEqual(
				snapshot.resourceTemplates.map(({ uriTemplate }) => uriTemplate),
				['test://items/{id}'],
			);
		}));
});

suite('authentication', () => {
	test('an AuthProvider refreshes its token after a 401 and the request is retried', () =>
		withServer({ requireToken: 'fresh' }, async (server) => {
			let token = 'stale';
			let refreshed = 0;
			const client = await connect(server, {
				auth: {
					provider: {
						token: async () => token,
						onUnauthorized: async () => {
							refreshed += 1;
							token = 'fresh';
						},
					},
				},
			});

			const outcome = await client.callTool('call-20', 'error_without_output');
			await client.close();

			assert.equal(outcome.outcome, 'result');
			assert.equal(refreshed, 1);
			assert.ok(server.requests.some(({ headers }) => headers.authorization === 'Bearer fresh'));
		}));

	test('connecting with credentials over plain HTTP to another host is refused before any request', async () => {
		await assert.rejects(
			McpClient.connect({
				url: 'http://mcp.example.test/mcp',
				clientInfo: { name: 'mcp-client-test', version: '0.0.0' },
				auth: { headers: { Authorization: 'Bearer secret' } },
			}),
			/Refusing to send credentials over plain HTTP to mcp\.example\.test/,
		);
	});

	test('credentials over plain HTTP are allowed to loopback, over HTTPS, or by explicit opt-in', () => {
		const auth = { headers: { Authorization: 'Bearer secret' } };
		const allowed: [string, Parameters<typeof assertCredentialTransport>[1]][] = [
			['http://127.0.0.1:3000/mcp', { auth }],
			['http://127.8.9.10/mcp', { auth }],
			['http://localhost/mcp', { auth }],
			['http://[::1]/mcp', { auth }],
			['https://mcp.example.test/mcp', { auth }],
			['http://mcp.example.test/mcp', {}],
			['http://mcp.example.test/mcp', { auth, allowInsecureHttp: true }],
		];

		for (const [url, options] of allowed) {
			assert.doesNotThrow(() => assertCredentialTransport(new URL(url), options), url);
		}
		assert.throws(() => assertCredentialTransport(new URL('http://127.example.test/mcp'), { auth }));
	});
});

suite('connecting', () => {
	test('throws when the surface cannot be read', () =>
		withServer({ failMethod: 'tools/list' }, async (server) => {
			await assert.rejects(connect(server));
		}));

	test('connects even when the host’s onError throws', () =>
		withServer({ maxSubscriptions: 0 }, async (server) => {
			let reported = 0;
			const client = await connect(server, {
				changeNotifications: { onChange: () => undefined },
				onError: () => {
					reported += 1;
					throw new Error('host onError threw');
				},
			});
			try {
				await until(() => reported > 0);
				const outcome = await client.callTool('call-21', 'error_without_output');

				assert.equal(outcome.outcome, 'result');
			} finally {
				await client.close();
			}
		}));

	test('reports a background failure, such as a refused change-notification stream', () =>
		withServer({ maxSubscriptions: 0 }, async (server) => {
			const errors: Error[] = [];
			const client = await connect(server, {
				changeNotifications: { onChange: () => undefined },
				onError: (error) => errors.push(error),
			});
			try {
				await until(() => errors.length > 0);
			} finally {
				await client.close();
			}
		}));
});
