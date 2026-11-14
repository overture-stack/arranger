import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { identifyEndpoint, type ServerRecord, ServerSetError } from './crossing.js';
import { functionCall, functionCallOutput, userMessage } from './messages.js';
import { emptyState, restoreState, STATE_VERSION, withEveryCallAnswered } from './state.js';
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
