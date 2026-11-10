import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';

import { createHarness, name, outputs, until, withHost } from '#testing/harness.js';
import { call, calls, say } from '#testing/scriptedProvider.js';
import { startTestServer, type TestServer } from '#testing/server.js';

import { requestCharacters, shortenedResult } from './context.js';
import type { McpHost } from './host.js';
import { userMessage } from './messages.js';
import { OUTPUT_LIMIT_RETRY_MESSAGE } from './run.js';
import { TOOL_MESSAGES } from './toolMessages.js';

suite('McpHost', () => {
	let server: TestServer;

	before(async () => {
		server = await startTestServer({ instructions: 'Use lookup for items.' });
	});

	after(async () => {
		await server.close();
	});

	suite('cancellation and limits', () => {
		test('cancelling during a call cancels it, and stops the calls after it', async () => {
			const harness = createHarness(server, [calls(call(name('slow')), call(name('lookup'), { id: '1' }))]);
			const controller = new AbortController();
			harness.on((event) => {
				if (event.type === 'tool_call' && event.tool === 'slow') {
					setTimeout(() => controller.abort(), 100);
				}
			});
			await withHost(harness, async (host) => {
				const probesBefore = server.probes.length;
				const done = await host.run({ message: 'go' }, { signal: controller.signal });

				assert.equal(done.reason, 'cancelled');
				assert.deepEqual(
					outputs(host.state().items).map(({ output }) => output),
					[TOOL_MESSAGES.cancelled, TOOL_MESSAGES.notRun],
				);
				await until(() => server.probes.length > probesBefore && server.probes.at(-1)?.finished === true);
				assert.equal(server.probes.at(-1)?.aborted, true);
			});
		});

		test('cancelling while a confirmation waits withdraws it', async () => {
			const harness = createHarness(server, [calls(call(name('confirm')))]);
			const controller = new AbortController();
			harness.on((event) => {
				if (event.type === 'input_required') {
					setTimeout(() => controller.abort(), 20);
				}
			});
			await withHost(harness, async (host) => {
				const done = await host.run({ message: 'go' }, { signal: controller.signal });
				assert.equal(done.reason, 'cancelled');
				assert.equal(outputs(host.state().items)[0]?.output, TOOL_MESSAGES.cancelled);
				assert.deepEqual(host.pending(), []);
				assert.equal(host.respond('call-1/1/confirm', { action: 'accept' }), 'already_answered');
				assert.deepEqual(
					harness.of('question_withdrawn').map(({ id, kind }) => [id, kind]),
					[['call-1/1/confirm', 'confirmation']],
				);
				assert.deepEqual(harness.of('input_answered'), []);
			});
		});

		test('cancelling while the model generates ends the run without a model error', async () => {
			const harness = createHarness(server, [{ hang: true }]);
			await withHost(harness, async (host) => {
				const controller = new AbortController();
				setTimeout(() => controller.abort(), 20);
				const done = await host.run({ message: 'go' }, { signal: controller.signal });
				assert.equal(done.reason, 'cancelled');
				assert.deepEqual(harness.of('model_error'), []);
				assert.equal(harness.provider.requests.length, 1, 'nothing is sent after the cancellation');
			});
		});

		test('cancelling while an approval waits withdraws it, and the call never runs', async () => {
			const harness = createHarness(server, [calls(call(name('lookup'), { id: '1' }))], {
				approvalPolicy: () => 'ask',
			});
			const controller = new AbortController();
			harness.on((event) => {
				if (event.type === 'approval_required') {
					setTimeout(() => controller.abort(), 20);
				}
			});
			await withHost(harness, async (host) => {
				const executedBefore = server.executed.length;
				const done = await host.run({ message: 'go' }, { signal: controller.signal });

				assert.equal(done.reason, 'cancelled');
				assert.equal(server.executed.length, executedBefore);
				assert.equal(outputs(host.state().items)[0]?.output, TOOL_MESSAGES.notRun);
				assert.deepEqual(host.pending(), []);
				assert.equal(host.respond('call-1/approval', { approve: true }), 'already_answered');
				assert.deepEqual(
					harness.of('question_withdrawn').map(({ id, kind, callId }) => [id, kind, callId]),
					[['call-1/approval', 'approval', 'call-1']],
				);
				assert.deepEqual(harness.of('approval_answered'), []);
			});
		});

		test('a state taken while a call is on the wire says its effect is unknown', async () => {
			const harness = createHarness(server, [calls(call(name('slow')))]);
			const controller = new AbortController();
			let midCall: string | undefined;
			harness.on((event, host) => {
				if (event.type === 'tool_call') {
					setTimeout(() => {
						midCall = outputs(host.state().items)[0]?.output;
						controller.abort();
					}, 50);
				}
			});
			await withHost(harness, async (host) => {
				await host.run({ message: 'go' }, { signal: controller.signal });
				assert.equal(midCall, TOOL_MESSAGES.transportError);
			});
		});

		test('the tool-call limit ends the run, and later calls are not run', async () => {
			const harness = createHarness(
				server,
				[calls(call(name('lookup'), { id: '1' }), call(name('lookup'), { id: '2' }))],
				{
					limits: { turns: 10, toolCalls: 1, wallClockMs: 30_000 },
				},
			);
			await withHost(harness, async (host) => {
				const done = await host.run({ message: 'go' });
				assert.equal(done.reason, 'tool_call_limit');
				assert.deepEqual(
					outputs(host.state().items).map(({ output }) => output),
					['found 1', TOOL_MESSAGES.notRun],
				);
			});
		});

		test('the turn limit ends the run with every call answered', async () => {
			const harness = createHarness(server, [calls(call(name('lookup'), { id: '1' }))], {
				limits: { turns: 1, toolCalls: 10, wallClockMs: 30_000 },
			});
			await withHost(harness, async (host) => {
				const done = await host.run({ message: 'go' });
				assert.equal(done.reason, 'turn_limit');
				assert.equal(harness.provider.requests.length, 1);
				assert.equal(outputs(host.state().items).length, 1);
			});
		});

		test('the time limit ends the run, and a call it cut off is reported as of unknown effect', async () => {
			const harness = createHarness(server, [calls(call(name('slow')))], {
				limits: { turns: 10, toolCalls: 10, wallClockMs: 200 },
			});
			await withHost(harness, async (host) => {
				const done = await host.run({ message: 'go' });
				assert.equal(done.reason, 'time_limit');
				assert.equal(outputs(host.state().items)[0]?.output, TOOL_MESSAGES.transportError);
			});
		});
	});

	suite('model replies', () => {
		test('a model error ends the run without retrying, and the conversation stays valid', async () => {
			const error = { kind: 'http' as const, message: 'Bad gateway', status: 502, body: 'upstream' };
			const harness = createHarness(server, [calls(call(name('lookup'), { id: '1' })), { error }]);
			await withHost(harness, async (host) => {
				const done = await host.run({ message: 'go' });
				assert.equal(done.reason, 'model_error');
				assert.deepEqual(harness.of('model_error')[0]?.error, error);
				assert.equal(harness.provider.requests.length, 2);
				assert.equal(outputs(host.state().items).length, 1);
			});
		});

		test('a stream that ends without a response, or a provider that throws, is a model error', async () => {
			for (const [step, kind] of [
				[{ endEarly: true }, 'stream_ended'],
				[{ throws: 'socket hang up' }, 'unknown'],
			] as const) {
				const harness = createHarness(server, [step]);
				await withHost(harness, async (host) => {
					assert.equal((await host.run({ message: 'go' })).reason, 'model_error');
					assert.equal(harness.of('model_error')[0]?.error.kind, kind);
				});
			}
		});

		test('an empty reply is retried once with a new seed, and kept out of the conversation', async () => {
			const harness = createHarness(
				server,
				[say('', { usage: { inputTokens: 10, outputTokens: 40 } }), say('Hello')],
				{
					model: { model: 'm', temperature: 0, topP: 1, seed: 7, maxOutputTokens: 100 },
				},
			);
			await withHost(harness, async (host) => {
				const done = await host.run({ message: 'Hi' });
				assert.equal(done.reason, 'answered');
				assert.equal(done.totals.turns, 2, 'the retry counts as a turn');
				assert.deepEqual(
					harness.provider.requests.map(({ seed }) => seed),
					[7, 8],
				);
				assert.deepEqual(harness.provider.requests[1]?.messages, harness.provider.requests[0]?.messages);
				const [empty] = harness.of('empty_reply');
				assert.deepEqual([empty?.outputTokens, empty?.retrying], [40, true]);
				assert.equal(harness.of('model_request')[1]?.retryOf, 'empty_reply');
				assert.equal(host.state().items.length, 2);
			});
		});

		test('a second empty reply, or one with retries off, ends the run', async () => {
			const twice = createHarness(server, [say(''), say('')]);
			await withHost(twice, async (host) => {
				assert.equal((await host.run({ message: 'Hi' })).reason, 'empty_reply');
				assert.deepEqual(
					twice.of('empty_reply').map(({ retrying }) => retrying),
					[true, false],
				);
			});

			const off = createHarness(server, [say('')], { retries: { emptyReply: false, outputLimit: false } });
			await withHost(off, async (host) => {
				assert.equal((await host.run({ message: 'Hi' })).reason, 'empty_reply');
				assert.equal(off.provider.requests.length, 1);
				assert.equal(off.of('empty_reply').length, 1, 'the event is kept either way');
			});
		});

		test('a reply cut off with no text is retried once, with a request-only nudge and less reasoning', async () => {
			const harness = createHarness(
				server,
				[
					say('', { stopReason: 'length', reasoning: 'hmm', usage: { inputTokens: 5, outputTokens: 100 } }),
					say('Short'),
				],
				{},
				{ reduceReasoning: true },
			);
			await withHost(harness, async (host) => {
				const done = await host.run({ message: 'Hi' });
				assert.equal(done.reason, 'answered');
				const retry = harness.provider.requests[1];
				assert.deepEqual(retry?.messages.at(-1), userMessage(OUTPUT_LIMIT_RETRY_MESSAGE));
				assert.equal(retry?.extra?.reasoning_effort, 'low');
				assert.deepEqual(harness.of('output_limit')[0]?.retrying, true);
				assert.deepEqual(
					host.state().items.map((item) => item.type === 'message' && item.text),
					['Hi', 'Short'],
				);
			});
		});

		test('a reply cut off with text keeps the text, marked, and ends the run', async () => {
			const harness = createHarness(server, [say('The answer is', { stopReason: 'length' })]);
			await withHost(harness, async (host) => {
				const done = await host.run({ message: 'Hi' });
				assert.equal(done.reason, 'output_limit');
				assert.equal(harness.provider.requests.length, 1);
				const last = host.state().items.at(-1);
				assert.deepEqual(last?.type === 'message' && last.role === 'assistant' && [last.text, last.truncated], [
					'The answer is',
					true,
				]);
			});
		});

		test('an output-limit retry that comes back empty ends the run: one retry per step', async () => {
			const harness = createHarness(server, [say('', { stopReason: 'length' }), say(''), say('never sent')]);
			await withHost(harness, async (host) => {
				assert.equal((await host.run({ message: 'Hi' })).reason, 'empty_reply');
				assert.equal(harness.provider.requests.length, 2);
				assert.deepEqual(
					harness.of('empty_reply').map(({ retrying }) => retrying),
					[false],
				);
			});
		});

		test('a reply cut off twice ends the run', async () => {
			const harness = createHarness(server, [
				say('', { stopReason: 'length' }),
				say('', { stopReason: 'length' }),
			]);
			await withHost(harness, async (host) => {
				assert.equal((await host.run({ message: 'Hi' })).reason, 'output_limit');
				assert.equal(harness.provider.requests.length, 2);
			});
		});
	});

	suite('context window', () => {
		/** A window with room for the first big result and not the second. */
		const windowFor = async (host: McpHost) => {
			const { systemPrompt, tools } = host.surface();
			return Math.ceil(requestCharacters(systemPrompt, tools, [userMessage('go')]) / 3) + 100 + 1_500;
		};

		const bigTwice = () => [
			calls(call(name('big'), { size: 3_000 })),
			calls(call(name('big'), { size: 3_000 })),
			say('done'),
		];

		test('shortens the oldest result in the request only, and says so', async () => {
			const probe = createHarness(server, []);
			let tokens = 0;
			await withHost(probe, async (host) => {
				tokens = await windowFor(host);
			});

			const harness = createHarness(server, bigTwice(), {
				contextWindow: { tokens, policy: 'shorten', charsPerToken: 3 },
			});
			await withHost(harness, async (host) => {
				const done = await host.run({ message: 'go' });
				assert.equal(done.reason, 'answered');
				const [shortened] = harness.of('context_shortened');
				assert.deepEqual(shortened?.shortened, [{ callId: 'call-1', name: name('big') }]);
				assert.deepEqual(
					outputs(harness.provider.requests[2]?.messages ?? []).map(({ output }) => output.length),
					[shortenedResult(name('big')).length, 3_000],
				);
				assert.deepEqual(
					outputs(host.state().items).map(({ output }) => output.length),
					[3_000, 3_000],
				);
			});
		});

		test('ends the run instead under the fail policy', async () => {
			const probe = createHarness(server, []);
			let tokens = 0;
			await withHost(probe, async (host) => {
				tokens = await windowFor(host);
			});

			const harness = createHarness(server, bigTwice(), {
				contextWindow: { tokens, policy: 'fail', charsPerToken: 3 },
			});
			await withHost(harness, async (host) => {
				const done = await host.run({ message: 'go' });
				assert.equal(done.reason, 'context_window');
				assert.match(
					done.detail ?? '',
					/^The request needs about \d+ tokens of a \d+-token window, 100 of them reserved for the reply \(`maxOutputTokens`\)$/,
				);
				assert.equal(harness.provider.requests.length, 2);
				assert.deepEqual(harness.of('context_shortened'), []);
			});
		});

		test('ends the run when the server counts a longer prompt as shorter', async () => {
			const harness = createHarness(server, [
				{
					response: {
						toolCalls: [call(name('lookup'), { id: '1' })],
						stopReason: 'tool_calls',
						usage: { inputTokens: 3_562, outputTokens: 5 },
					},
				},
				say('Answered without the question', { usage: { inputTokens: 3_494, outputTokens: 5 } }),
			]);
			await withHost(harness, async (host) => {
				const done = await host.run({ message: 'go' });
				assert.equal(done.reason, 'context_window');
				assert.equal(harness.of('model_error')[0]?.error.kind, 'truncated');
				assert.equal(host.state().items.at(-1)?.type, 'function_call_output', 'the answer is not kept');
			});
		});
	});
});
