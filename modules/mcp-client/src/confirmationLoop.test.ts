import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { ProtocolError } from '@modelcontextprotocol/client';

import { runConfirmationLoop, type SendLeg } from './confirmationLoop.js';
import { type InputResolver } from './types.js';

const FORM = { type: 'object', properties: { confirm: { type: 'boolean' } } };

const accept: InputResolver = async () => ({ action: 'accept', content: { confirm: true } });

/** A server scripted leg by leg, recording what each leg was sent. */
const scripted = (...replies: unknown[]) => {
	const sent: Record<string, unknown>[] = [];
	const send: SendLeg = async (params) => {
		sent.push(params);
		const reply = replies.shift();
		if (reply instanceof Error) {
			throw reply;
		}
		return reply;
	};
	return { send, sent };
};

const asking = (inputRequests: Record<string, unknown>, requestState?: string) => ({
	resultType: 'input_required',
	inputRequests,
	...(requestState !== undefined && { requestState }),
});

const elicit = (params: Record<string, unknown> = {}) => ({
	method: 'elicitation/create',
	params: { message: 'Go?', requestedSchema: FORM, ...params },
});

const done = { content: [] };

suite('runConfirmationLoop', () => {
	test('echoes requestState exactly, including an empty string, with only this round’s answers', async () => {
		const { send, sent } = scripted(asking({ first: elicit() }, ''), asking({ second: elicit() }, 'b'), done);

		const outcome = await runConfirmationLoop({ callId: 'c', params: { name: 't' }, send, resolver: accept });

		assert.equal(outcome.outcome, 'result');
		assert.deepEqual(sent, [
			{ name: 't' },
			{
				name: 't',
				inputResponses: { first: { action: 'accept', content: { confirm: true } } },
				requestState: '',
			},
			{
				name: 't',
				inputResponses: { second: { action: 'accept', content: { confirm: true } } },
				requestState: 'b',
			},
		]);
	});

	test('fails a request for a method other than elicitation without asking anything', async () => {
		let asked = 0;
		const { send, sent } = scripted(
			asking({ confirm: elicit(), sample: { method: 'sampling/createMessage', params: { messages: [] } } }, 's'),
		);

		const outcome = await runConfirmationLoop({
			callId: 'c',
			params: {},
			send,
			resolver: async () => {
				asked += 1;
				return { action: 'accept' };
			},
		});

		assert.equal(outcome.outcome, 'input_failed');
		assert.equal(outcome.reason, 'unsupported_request');
		assert.equal(outcome.key, 'sample');
		assert.equal(outcome.method, 'sampling/createMessage');
		assert.equal(asked, 0);
		assert.equal(sent.length, 1);
	});

	test('fails a URL-mode elicitation, since only forms are declared', async () => {
		const { send } = scripted(asking({ signIn: elicit({ mode: 'url', url: 'https://example.test' }) }));

		const outcome = await runConfirmationLoop({ callId: 'c', params: {}, send, resolver: accept });

		assert.equal(outcome.outcome, 'input_failed');
		assert.equal(outcome.reason, 'unsupported_request');
	});

	test('fails a question when no resolver is configured', async () => {
		const { send } = scripted(asking({ confirm: elicit() }));

		const outcome = await runConfirmationLoop({ callId: 'c', params: {}, send });

		assert.equal(outcome.outcome, 'input_failed');
		assert.equal(outcome.reason, 'unsupported_request');
	});

	test('still reports the round before failing it', async () => {
		const rounds: unknown[] = [];
		const { send } = scripted(asking({ sample: { method: 'roots/list' } }, 'kept'));

		await runConfirmationLoop({
			callId: 'c',
			params: {},
			send,
			resolver: accept,
			onRound: (round) => rounds.push(round),
		});

		assert.deepEqual(rounds, [{ callId: 'c', round: 1, requestState: 'kept', keys: ['sample'] }]);
	});

	test('withdraws a round’s other questions when one fails', async () => {
		let withdrawn = false;
		const { send } = scripted(asking({ a: elicit(), b: elicit() }, 's'));

		const outcome = await runConfirmationLoop({
			callId: 'c',
			params: {},
			send,
			resolver: ({ key, signal }) =>
				key === 'a'
					? Promise.reject(new Error('broken'))
					: new Promise((_resolve, reject) =>
							signal.addEventListener('abort', () => {
								withdrawn = true;
								reject(signal.reason);
							}),
						),
		});

		assert.equal(outcome.outcome, 'input_failed');
		assert.equal(outcome.reason, 'resolver_error');
		assert.equal(withdrawn, true);
	});

	test('fails a malformed request as unsupported, without throwing or asking anything', async () => {
		const malformed: [string, unknown][] = [
			['a null entry', null],
			['params that are not an object', { method: 'elicitation/create', params: 'yes' }],
			['a message that is not a string', elicit({ message: 42 })],
			['no requested schema', { method: 'elicitation/create', params: { message: 'Go?' } }],
			['no method', { params: { message: 'Go?', requestedSchema: FORM } }],
		];

		for (const [label, request] of malformed) {
			let asked = 0;
			const { send } = scripted(asking({ bad: request }, 's'));

			const outcome = await runConfirmationLoop({
				callId: 'c',
				params: {},
				send,
				resolver: async () => {
					asked += 1;
					return { action: 'accept' };
				},
			});

			assert.equal(outcome.outcome, 'input_failed', label);
			assert.equal(outcome.reason, 'unsupported_request', label);
			assert.equal(asked, 0, label);
		}
	});

	test('reports an unexpected failure inside the loop as an outcome, never a rejection', async () => {
		const hostile = {
			get resultType(): string {
				throw new Error('unreadable reply');
			},
		};

		const outcome = await runConfirmationLoop({
			callId: 'c',
			params: {},
			send: async () => hostile,
			resolver: accept,
		});

		assert.equal(outcome.outcome, 'transport_error');
		assert.equal(outcome.kind, 'unknown');
		assert.equal(outcome.message, 'unreadable reply');
	});

	test('treats a refused state on the first leg as an ordinary rejection', async () => {
		const refused = new ProtocolError(-32602, 'Invalid or expired requestState', {
			reason: 'invalid_request_state',
		});
		const { send } = scripted(refused);

		const outcome = await runConfirmationLoop({ callId: 'c', params: {}, send, resolver: accept });

		assert.equal(outcome.outcome, 'rejected');
	});

	test('reports a refused echoed state with how long its question waited', async () => {
		const refused = new ProtocolError(-32602, 'Invalid or expired requestState', {
			reason: 'invalid_request_state',
		});
		const { send } = scripted(asking({ confirm: elicit() }, 's'), refused);

		const outcome = await runConfirmationLoop({
			callId: 'c',
			params: {},
			send,
			resolver: async () => {
				await new Promise((resolve) => setTimeout(resolve, 50));
				return { action: 'accept' };
			},
		});

		assert.equal(outcome.outcome, 'input_state_rejected');
		assert.ok(outcome.waitedMs >= 40, `waited ${outcome.waitedMs}`);
		assert.equal(outcome.waitedMs, outcome.waitingMs);
	});

	test('ends the wait on abort even when the resolver ignores its signal', async () => {
		const controller = new AbortController();
		const { send, sent } = scripted(asking({ confirm: elicit() }, 's'), done);
		setTimeout(() => controller.abort(), 50);

		const outcome = await runConfirmationLoop({
			callId: 'c',
			params: {},
			send,
			resolver: () => new Promise(() => undefined),
			signal: controller.signal,
		});

		assert.equal(outcome.outcome, 'cancelled');
		assert.equal(sent.length, 1);
	});

	test('does not send when the signal has already aborted', async () => {
		const { send, sent } = scripted(done);

		const outcome = await runConfirmationLoop({ callId: 'c', params: {}, send, signal: AbortSignal.abort() });

		assert.equal(outcome.outcome, 'cancelled');
		assert.equal(sent.length, 0);
	});
});
