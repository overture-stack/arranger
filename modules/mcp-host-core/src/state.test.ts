import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { functionCall, functionCallOutput, userMessage } from './messages.js';
import {
	carriesRestrictedData,
	emptyState,
	holdsRestrictedData,
	identifyEndpoint,
	markReturnedData,
	reconcileServers,
	restoreState,
	type ServerRecord,
	ServerSetError,
	STATE_VERSION,
	withEveryCallAnswered,
} from './state.js';
import { TOOL_MESSAGES } from './toolMessages.js';

const OVERTURE = 'https://overture.example.org/mcp';
const GENES = 'https://genes.example.org/mcp';
const SERVERS = [{ key: 'overture', ...identifyEndpoint(OVERTURE), containsOnlyOpenData: false }];

const record = (
	key: string,
	url: string,
	containsOnlyOpenData: boolean,
	returnedData: ServerRecord['returnedData'],
): ServerRecord => ({ key, ...identifyEndpoint(url), containsOnlyOpenData, returnedData });

const withCalls = () => ({
	...emptyState(SERVERS),
	items: [
		userMessage('q'),
		functionCall({ callId: 'call-1', name: 'a', arguments: '{}' }),
		functionCall({ callId: 'call-2', name: 'b', arguments: '{}' }),
		functionCall({ callId: 'call-3', name: 'c', arguments: '{}' }),
		functionCallOutput('call-1', 'done', false),
	],
	nextCallSeq: 4,
});

suite('withEveryCallAnswered', () => {
	test('answers each unanswered call by where it stands, without changing the live state', () => {
		const live = withCalls();
		const answered = withEveryCallAnswered(live, (callId) => (callId === 'call-2' ? 'confirming' : 'queued'));

		assert.deepEqual(answered.items.slice(5), [
			functionCallOutput('call-2', TOOL_MESSAGES.abandoned, true),
			functionCallOutput('call-3', TOOL_MESSAGES.notRun, true),
		]);
		assert.equal(live.items.length, 5);
	});

	test('gives a call on the wire the transport-error wording, since its effect is unknown', () => {
		const answered = withEveryCallAnswered(withCalls(), (callId) => (callId === 'call-2' ? 'in_flight' : 'queued'));
		assert.deepEqual(answered.items[5], functionCallOutput('call-2', TOOL_MESSAGES.transportError, true));
	});
});

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
		const connections = [record('overture', OVERTURE, false, 'restricted'), record('genes', GENES, true, 'none')];

		assert.equal(carriesRestrictedData({ call: { server: 'overture' }, connections }), false, 'its own follow-up');
		assert.equal(carriesRestrictedData({ call: { server: 'genes' }, connections }), true);
		assert.equal(
			carriesRestrictedData({
				call: { server: 'overture' },
				connections: [
					record('overture', OVERTURE, false, 'none'),
					record('genes', GENES, true, 'unrestricted'),
				],
			}),
			false,
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

suite('restoreState', () => {
	test('survives a JSON round trip', () => {
		const saved = JSON.parse(JSON.stringify(withEveryCallAnswered(withCalls(), () => 'queued')));
		assert.deepEqual(restoreState(saved, SERVERS), saved);
	});

	test('checks the configured servers against the saved ones', () => {
		const saved = JSON.parse(
			JSON.stringify({ ...emptyState(SERVERS), servers: [record('overture', OVERTURE, false, 'restricted')] }),
		);
		assert.throws(
			() =>
				restoreState(saved, [
					...SERVERS,
					{ key: 'other', ...identifyEndpoint(GENES), containsOnlyOpenData: true },
				]),
			ServerSetError,
		);
	});

	test('refuses anything that is not a state of this version, down to its items and records', () => {
		const state = emptyState(SERVERS);
		const broken: unknown[] = [
			{ ...state, version: STATE_VERSION + 1 },
			{ ...state, servers: [{ key: 'x' }] },
			{ ...state, items: [{ type: 'message', role: 'system', text: 'x' }] },
			{ ...state, items: [{ type: 'function_call', callId: 'call-1', name: 'a' }] },
			{ ...state, calls: [{ callId: 'call-1', server: 's', tool: 't' }] },
			{ ...state, carried: [{ from: {}, carriedAt: 'now' }] },
			{ ...state, carried: undefined },
			{ items: [] },
			null,
		];
		for (const saved of broken) {
			assert.throws(() => restoreState(saved, SERVERS), TypeError, JSON.stringify(saved));
		}
	});
});
