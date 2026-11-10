import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';

import { createHarness, type Harness, name, outputs, withHost, withServer } from '#testing/harness.js';
import { call, calls, malformed, say } from '#testing/scriptedProvider.js';
import { startTestServer, type TestServer } from '#testing/server.js';

import { type FunctionCallOutput } from './messages.js';
import { type ApprovalRequest, type McpHostOptions } from './options.js';
import { TOOL_MESSAGES } from './toolMessages.js';

suite('McpHost', () => {
	let server: TestServer;

	before(async () => {
		server = await startTestServer({ instructions: 'Use lookup for items.' });
	});

	after(async () => {
		await server.close();
	});

	suite('tool messages', () => {
		/** Runs one call to `tool` and returns its tool message and `tool_result` event. */
		const callOnce = async (
			tool: string,
			args: unknown = {},
			overrides: Partial<McpHostOptions> = {},
			onHost?: (harness: Harness) => void,
			target: TestServer = server,
		) => {
			const harness = createHarness(target, [calls(call(tool, args)), say('ok')], overrides);
			onHost?.(harness);
			let message: FunctionCallOutput | undefined;
			await withHost(harness, async (host) => {
				await host.run({ message: 'go' });
				message = outputs(host.state().items)[0];
			});
			const [result] = harness.of('tool_result');
			return { message, result, harness };
		};

		test('a result: its text, and an error only with isError', async () => {
			const ok = await callOnce(name('lookup'), { id: '1' });
			assert.deepEqual([ok.message?.output, ok.message?.isError], ['found 1', false]);

			const failed = await callOnce(name('fails'));
			assert.deepEqual([failed.message?.output, failed.message?.isError], ['it failed', true]);
		});

		test('a result with an image, an embedded resource, or only structured content', async () => {
			assert.equal((await callOnce(name('picture'))).message?.output, 'a chart\n[image omitted]');
			assert.equal((await callOnce(name('embedded'))).message?.output, '[resource omitted: test://embedded]');
			assert.equal((await callOnce(name('structured'))).message?.output, '{"count":3}');
		});

		test('output_invalid', async () => {
			const { message, result } = await callOnce(name('bad_output'));
			assert.equal(message?.output, TOOL_MESSAGES.outputInvalid);
			assert.equal(result?.outcome.outcome, 'output_invalid');
		});

		test('rejected, with the server message', async () => {
			const { message, result } = await callOnce(name('asks_sampling'));
			assert.equal(result?.outcome.outcome, 'rejected');
			assert.ok(message?.output.startsWith(`${TOOL_MESSAGES.rejected}: `));
		});

		test('rounds_exceeded', async () => {
			const { message } = await callOnce(
				name('always_asks'),
				{},
				{
					servers: [
						{
							key: 'test',
							trusted: true,
							connection: { url: server.url, maxRounds: 1 },
						},
					],
				},
				(harness) =>
					harness.on((event, host) => {
						if (event.type === 'input_required') {
							host.respond(event.questionId, { action: 'accept', content: { confirm: true } });
						}
					}),
			);
			assert.equal(message?.output, TOOL_MESSAGES.roundsExceeded);
		});

		test('transport_error', () =>
			withServer({}, async (failing) => {
				const harness = createHarness(failing, [calls(call(name('lookup'), { id: '1' })), say('ok')]);
				await withHost(harness, async (host) => {
					failing.state.failMethod = 'tools/call';
					await host.run({ message: 'go' });
					assert.equal(outputs(host.state().items)[0]?.output, TOOL_MESSAGES.transportError);
					assert.equal(harness.of('tool_result')[0]?.outcome.outcome, 'transport_error');
				});
			}));

		test('input_state_rejected, with its event', () =>
			withServer({ ttlSeconds: 1 }, async (expiring) => {
				const { message, harness } = await callOnce(
					name('confirm'),
					{},
					{},
					(harness) =>
						harness.on((event, host) => {
							if (event.type === 'input_required') {
								setTimeout(
									() =>
										host.respond(event.questionId, {
											action: 'accept',
											content: { confirm: true },
										}),
									2_100,
								);
							}
						}),
					expiring,
				);
				assert.equal(message?.output, TOOL_MESSAGES.inputStateRejected);
				const [rejected] = harness.of('input_state_rejected');
				assert.equal(rejected?.server, 'test');
				assert.ok((rejected?.waitedMs ?? 0) >= 2_000);
			}));

		test('denied by the policy', async () => {
			const executedBefore = server.executed.length;
			const { message, result } = await callOnce(name('lookup'), { id: '1' }, { approvalPolicy: () => 'deny' });
			assert.equal(message?.output, TOOL_MESSAGES.denied);
			assert.deepEqual(result?.outcome, { outcome: 'denied', by: 'policy' });
			assert.equal(server.executed.length, executedBefore);
		});

		test('denied when the policy throws', async () => {
			const { result } = await callOnce(
				name('lookup'),
				{ id: '1' },
				{
					approvalPolicy: () => {
						throw new Error('policy broke');
					},
				},
			);
			assert.deepEqual(result?.outcome, { outcome: 'denied', by: 'policy_error', message: 'policy broke' });
		});

		test('malformed, from the provider or from arguments that are not an object', async () => {
			const harness = createHarness(server, [
				calls(
					malformed('{"id": ', name('lookup')),
					call(name('lookup'), '{"id": '),
					call(name('lookup'), '[1]'),
				),
				say('ok'),
			]);
			await withHost(harness, async (host) => {
				const done = await host.run({ message: 'go' });
				assert.deepEqual(
					outputs(host.state().items).map(({ output }) => output),
					[TOOL_MESSAGES.malformed, TOOL_MESSAGES.malformed, TOOL_MESSAGES.malformed],
				);
				assert.deepEqual(
					harness.of('malformed_tool_call').map(({ call }) => call.raw),
					['{"id": ', '{"id": ', '[1]'],
				);
				assert.equal(done.totals.toolCalls, 3, 'malformed calls count against the call limit');
				const recorded = host.state().items.find((item) => item.type === 'function_call');
				assert.equal(
					recorded?.type === 'function_call' && recorded.arguments,
					'{"id": ',
					'the raw text is kept',
				);
			});
		});

		test('unknown tool', async () => {
			const { message, result } = await callOnce(name('no_such_tool'));
			assert.equal(message?.output, TOOL_MESSAGES.unknownTool);
			assert.equal(result?.outcome.outcome, 'unknown_tool');
		});

		test('cut to the configured cap, with the full result kept in the event', async () => {
			const { message, result } = await callOnce(name('big'), { size: 500 }, { toolResultMaxChars: 100 });
			assert.equal(message?.output, `${'x'.repeat(100)}\n[Result cut to 100 of 500 characters]`);
			const content = result?.outcome.outcome === 'result' ? result.outcome.result.content[0] : undefined;
			assert.equal(content?.type === 'text' && content.text.length, 500);
		});
	});

	suite('approvals and confirmations', () => {
		test('asks the consumer, and answers by id', async () => {
			const harness = createHarness(server, [calls(call(name('lookup'), { id: '1' })), say('ok')], {
				approvalPolicy: () => 'ask',
			});
			const answers: string[] = [];
			harness.on((event, host) => {
				if (event.type === 'approval_required') {
					assert.deepEqual(
						host.pending().map(({ id }) => id),
						[event.id],
					);
					answers.push(host.respond(event.id, { approve: true }));
					answers.push(host.respond(event.id, { approve: false }));
					answers.push(host.respond('call-99/approval', { approve: true }));
				}
			});
			await withHost(harness, async (host) => {
				await host.run({ message: 'go' });
				assert.deepEqual(answers, ['accepted', 'already_answered', 'unknown']);
				assert.equal(outputs(host.state().items)[0]?.output, 'found 1');
				assert.deepEqual(
					harness.of('approval_answered').map(({ decision, timedOut }) => [decision, timedOut]),
					[['allow', false]],
				);
				assert.deepEqual(host.pending(), []);
			});
		});

		test('shows the policy only the call, and records every call that reached a server, across runs', async () => {
			const seen: ApprovalRequest[] = [];
			const harness = createHarness(
				server,
				[calls(call(name('lookup'), { id: '1' })), say('ok'), calls(call(name('catalogue.search'))), say('ok')],
				{
					approvalPolicy: (request) => {
						seen.push(request);
						return 'allow';
					},
				},
			);
			await withHost(harness, async (host) => {
				await host.run({ message: 'one' });
				await host.run({ message: 'two' });
				assert.deepEqual(seen[0], {
					call: { callId: 'call-1', server: 'test', tool: 'lookup', arguments: { id: '1' } },
				});
				assert.deepEqual(
					host.state().calls.map(({ server, tool }) => `${server}/${tool}`),
					['test/lookup', 'test/catalogue.search'],
				);
			});
		});

		test('an approval that times out counts as denied', async () => {
			const harness = createHarness(server, [calls(call(name('lookup'), { id: '1' })), say('ok')], {
				approvalPolicy: () => 'ask',
				approvalTimeoutMs: 30,
			});
			await withHost(harness, async (host) => {
				await host.run({ message: 'go' });
				const [required] = harness.of('approval_required');
				assert.equal(outputs(host.state().items)[0]?.output, TOOL_MESSAGES.denied);
				assert.equal(harness.of('approval_answered')[0]?.timedOut, true);
				assert.equal(host.respond(required?.id ?? '', { approve: true }), 'timed_out');
			});
		});

		test('passes a server confirmation to the consumer, and its answer to the server', async () => {
			const harness = createHarness(server, [calls(call(name('confirm'))), say('ok')]);
			harness.on((event, host) => {
				if (event.type === 'input_required') {
					host.respond(event.questionId, { action: 'accept', content: { confirm: true } });
				}
			});
			await withHost(harness, async (host) => {
				await host.run({ message: 'go' });
				const [required] = harness.of('input_required');
				assert.deepEqual(
					[required?.questionId, required?.server, required?.message],
					['call-1/1/confirm', 'test', 'Run it?'],
				);
				assert.equal(harness.of('input_answered')[0]?.timedOut, false);
				assert.equal(outputs(host.state().items)[0]?.output, 'ran');
			});
		});

		test('a confirmation that times out is answered cancel', async () => {
			const harness = createHarness(server, [calls(call(name('confirm'))), say('ok')], {
				confirmations: { timeoutMs: 30 },
			});
			await withHost(harness, async (host) => {
				await host.run({ message: 'go' });
				const [answered] = harness.of('input_answered');
				assert.deepEqual([answered?.answer, answered?.timedOut], [{ action: 'cancel' }, true]);
				assert.equal(outputs(host.state().items)[0]?.output, 'not confirmed');
				assert.equal(host.respond(answered?.questionId ?? '', { action: 'accept' }), 'timed_out');
			});
		});

		test('without confirmations, the server is never asked to confirm', async () => {
			const harness = createHarness(server, [calls(call(name('confirm'))), say('ok')], { confirmations: false });
			await withHost(harness, async (host) => {
				await host.run({ message: 'go' });
				assert.deepEqual(harness.of('input_required'), []);
				assert.equal(harness.of('tool_result')[0]?.outcome.outcome, 'rejected');
			});
		});
	});
});
