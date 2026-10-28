import assert from 'node:assert/strict';
import { after, before, mock, suite, test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';

import { McpClient } from '@overture-stack/arranger-mcp-client';

import { chunk, events, startModelServer, usageChunk, writeStream } from '#testing/modelServer.js';
import { call, calls, malformed, type ScriptStep, ScriptedProvider, say } from '#testing/scriptedProvider.js';
import { LONG_TOOL_NAME, startTestServer, type TestServer, type TestServerOptions } from '#testing/server.js';

import { requestCharacters, shortenedResult } from './context.js';
import { type HostEvent } from './events.js';
import {
	type ApprovalRequest,
	carriedLabel,
	McpHost,
	type McpHostOptions,
	OUTPUT_LIMIT_RETRY_MESSAGE,
	RunActiveError,
} from './host.js';
import { type ConversationItem, type FunctionCallOutput, isFunctionCallOutput, userMessage } from './messages.js';
import { OpenAiCompatibleProvider } from './providers/openAiCompatible.js';
import { instructionsHeading, reduceToolName } from './registry.js';
import { emptyState, holdsRestrictedData, identifyEndpoint, ServerSetError } from './state.js';
import { crossingRefusedMessage, TOOL_MESSAGES } from './toolMessages.js';

const name = (tool: string) => reduceToolName('test', tool);

type Harness = {
	provider: ScriptedProvider;
	events: HostEvent[];
	options: McpHostOptions;
	/** Adds a listener, called after the event is recorded. */
	on: (listener: (event: HostEvent, host: McpHost) => void) => void;
	of: <T extends HostEvent['type']>(type: T) => Extract<HostEvent, { type: T }>[];
	create: () => Promise<McpHost>;
};

const harness = (
	server: TestServer,
	steps: ScriptStep[],
	overrides: Partial<McpHostOptions> = {},
	providerOptions: ConstructorParameters<typeof ScriptedProvider>[1] = {},
): Harness => {
	const provider = new ScriptedProvider(steps, providerOptions);
	const events: HostEvent[] = [];
	const listeners: ((event: HostEvent, host: McpHost) => void)[] = [];
	let host: McpHost | undefined;
	const options: McpHostOptions = {
		servers: [{ key: 'test', trusted: true, connection: { url: server.url } }],
		provider,
		model: { model: 'scripted', temperature: 0, topP: 1, maxOutputTokens: 100 },
		approvalPolicy: () => 'allow',
		confirmations: {},
		limits: { turns: 10, toolCalls: 10, wallClockMs: 30_000 },
		retries: { emptyReply: true, outputLimit: true },
		contextWindow: { tokens: 1_000_000, policy: 'shorten' },
		clientInfo: { name: 'mcp-host-core-test', version: '0.0.0' },
		onEvent: (event) => {
			events.push(event);
			for (const listener of listeners) {
				if (host) {
					listener(event, host);
				}
			}
		},
		...overrides,
	};
	return {
		provider,
		events,
		options,
		on: (listener) => listeners.push(listener),
		of: (type) => events.filter((event) => event.type === type) as never,
		create: async () => {
			host = await McpHost.create(options);
			return host;
		},
	};
};

/** Each tool message, in order. */
const outputs = (items: readonly ConversationItem[]): FunctionCallOutput[] => items.filter(isFunctionCallOutput);

const until = async (check: () => boolean, timeoutMs = 3_000) => {
	const deadline = Date.now() + timeoutMs;
	while (!check()) {
		if (Date.now() > deadline) {
			assert.fail('condition not met in time');
		}
		await sleep(10);
	}
};

const withServer = async (options: TestServerOptions, body: (server: TestServer) => Promise<void>) => {
	const server = await startTestServer(options);
	try {
		await body(server);
	} finally {
		await server.close();
	}
};

/** Runs one host against `server`, closed however the test ends. */
const withHost = async (h: Harness, body: (host: McpHost) => Promise<void>) => {
	const host = await h.create();
	try {
		await body(host);
	} finally {
		await host.close();
	}
};

suite('McpHost', () => {
	let server: TestServer;

	before(async () => {
		server = await startTestServer({ instructions: 'Use lookup for items.' });
	});

	after(async () => {
		await server.close();
	});

	suite('a run', () => {
		test('ends when the model answers in text, with every event in order', async () => {
			const h = harness(
				server,
				[{ deltas: ['Hel', 'lo'], response: { text: 'Hello', stopReason: 'stop' } }],
				{},
				{ digest: 'sha256:abc' },
			);
			await withHost(h, async (host) => {
				const done = await host.run({ message: 'Hi' });

				assert.equal(done.reason, 'answered');
				assert.deepEqual(
					h.events.map(({ type }) => type),
					['run_started', 'model_request', 'token', 'token', 'model_response', 'done'],
				);
				assert.deepEqual(
					h.events.map(({ seq }) => seq),
					[0, 1, 2, 3, 4, 5],
				);
				assert.equal(new Set(h.events.map(({ runId }) => runId)).size, 1);
				const [started] = h.of('run_started');
				assert.equal(started?.modelDigest, 'sha256:abc');
				assert.equal(started?.providerUrl, h.provider.url);
				assert.equal(started?.servers[0]?.server?.name, 'mcp-host-core-test-server');
				assert.match(started?.servers[0]?.hash ?? '', /^[0-9a-f]{64}$/);
				assert.deepEqual(
					host.state().items.map((item) => item.type === 'message' && `${item.role}: ${item.text}`),
					['user: Hi', 'assistant: Hello'],
				);
			});
		});

		test('sends the trusted server instructions, every tool, and the model settings', async () => {
			const h = harness(server, [say('ok')], {
				systemPrompt: 'Be brief.',
				model: { model: 'm', temperature: 0.2, topP: 0.9, seed: 4, maxOutputTokens: 50, extra: { top_k: 1 } },
			});
			await withHost(h, async (host) => {
				await host.run({ message: 'Hi' });

				const [request] = h.provider.requests;
				assert.equal(
					request?.systemPrompt,
					`Be brief.\n\n${instructionsHeading('test')}\nUse lookup for items.`,
				);
				assert.deepEqual(
					[request?.temperature, request?.topP, request?.seed, request?.extra],
					[0.2, 0.9, 4, { top_k: 1 }],
				);
				assert.ok(request?.tools.some((tool) => tool.name === name('lookup')));
				assert.deepEqual(request?.tools, host.surface().tools);
			});
		});

		test("leaves out an untrusted server's instructions", async () => {
			const h = harness(server, [say('ok')], {
				servers: [{ key: 'test', connection: { url: server.url } }],
			});
			await withHost(h, async (host) => {
				await host.run({ message: 'Hi' });
				assert.equal(h.provider.requests[0]?.systemPrompt, '');
			});
		});

		test('routes calls through the registry, one at a time, and sends each tool message back', async () => {
			const h = harness(server, [
				calls(
					call(name('lookup'), { id: '7' }, 'model-a'),
					call(name('catalogue.search')),
					call(reduceToolName('test', LONG_TOOL_NAME)),
				),
				say('done'),
			]);
			await withHost(h, async (host) => {
				const executedBefore = server.executed.length;
				const done = await host.run({ message: 'Find 7' });

				assert.equal(done.reason, 'answered');
				assert.deepEqual(server.executed.slice(executedBefore), ['lookup', 'catalogue.search', LONG_TOOL_NAME]);
				assert.deepEqual(
					h.of('tool_call').map(({ callId, tool, modelCallId }) => [callId, tool, modelCallId]),
					[
						['call-1', 'lookup', 'model-a'],
						['call-2', 'catalogue.search', undefined],
						['call-3', LONG_TOOL_NAME, undefined],
					],
				);
				assert.deepEqual(
					outputs(h.provider.requests[1]?.messages ?? []).map(({ output }) => output),
					['found 7', 'searched', 'long'],
				);
				assert.deepEqual(done.totals.toolCalls, 3);
			});
		});

		test('refuses a second run while one is active', async () => {
			const h = harness(server, [{ hang: true }]);
			await withHost(h, async (host) => {
				const controller = new AbortController();
				const first = host.run({ message: 'one' }, { signal: controller.signal });

				await assert.rejects(host.run({ message: 'two' }), RunActiveError);
				controller.abort();
				assert.equal((await first).reason, 'cancelled');
			});
		});

		test('lets a listener start the next run from done', async () => {
			const h = harness(server, [say('one'), say('two')]);
			let next: Promise<unknown> | undefined;
			h.on((event, host) => {
				if (event.type === 'done' && !next) {
					next = host.run({ message: 'again' });
				}
			});
			await withHost(h, async (host) => {
				await host.run({ message: 'Hi' });
				const second = await next;
				assert.equal((second as { reason: string }).reason, 'answered');
				assert.equal(h.provider.requests.length, 2);
			});
		});

		test('keeps every event plain data', async () => {
			const h = harness(server, [calls(call(name('picture'))), say('ok')]);
			await withHost(h, async (host) => {
				await host.run({ message: 'Hi' });
				for (const event of h.events) {
					assert.deepEqual(JSON.parse(JSON.stringify(event)), event, event.type);
				}
			});
		});
	});

	suite('tool messages', () => {
		/** Runs one call to `tool` and returns its tool message and `tool_result` event. */
		const callOnce = async (
			tool: string,
			args: unknown = {},
			overrides: Partial<McpHostOptions> = {},
			onHost?: (h: Harness) => void,
			target: TestServer = server,
		) => {
			const h = harness(target, [calls(call(tool, args)), say('ok')], overrides);
			onHost?.(h);
			let message: FunctionCallOutput | undefined;
			await withHost(h, async (host) => {
				await host.run({ message: 'go' });
				message = outputs(host.state().items)[0];
			});
			const [result] = h.of('tool_result');
			return { message, result, h };
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
				(h) =>
					h.on((event, host) => {
						if (event.type === 'input_required') {
							host.respond(event.questionId, { action: 'accept', content: { confirm: true } });
						}
					}),
			);
			assert.equal(message?.output, TOOL_MESSAGES.roundsExceeded);
		});

		test('transport_error', () =>
			withServer({}, async (failing) => {
				const h = harness(failing, [calls(call(name('lookup'), { id: '1' })), say('ok')]);
				await withHost(h, async (host) => {
					failing.state.failMethod = 'tools/call';
					await host.run({ message: 'go' });
					assert.equal(outputs(host.state().items)[0]?.output, TOOL_MESSAGES.transportError);
					assert.equal(h.of('tool_result')[0]?.outcome.outcome, 'transport_error');
				});
			}));

		test('input_state_rejected, with its event', () =>
			withServer({ ttlSeconds: 1 }, async (expiring) => {
				const { message, h } = await callOnce(
					name('confirm'),
					{},
					{},
					(h) =>
						h.on((event, host) => {
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
				const [rejected] = h.of('input_state_rejected');
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
			const h = harness(server, [
				calls(
					malformed('{"id": ', name('lookup')),
					call(name('lookup'), '{"id": '),
					call(name('lookup'), '[1]'),
				),
				say('ok'),
			]);
			await withHost(h, async (host) => {
				const done = await host.run({ message: 'go' });
				assert.deepEqual(
					outputs(host.state().items).map(({ output }) => output),
					[TOOL_MESSAGES.malformed, TOOL_MESSAGES.malformed, TOOL_MESSAGES.malformed],
				);
				assert.deepEqual(
					h.of('malformed_tool_call').map(({ call }) => call.raw),
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
			const h = harness(server, [calls(call(name('lookup'), { id: '1' })), say('ok')], {
				approvalPolicy: () => 'ask',
			});
			const answers: string[] = [];
			h.on((event, host) => {
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
			await withHost(h, async (host) => {
				await host.run({ message: 'go' });
				assert.deepEqual(answers, ['accepted', 'already_answered', 'unknown']);
				assert.equal(outputs(host.state().items)[0]?.output, 'found 1');
				assert.deepEqual(
					h.of('approval_answered').map(({ decision, timedOut }) => [decision, timedOut]),
					[['allow', false]],
				);
				assert.deepEqual(host.pending(), []);
			});
		});

		test('shows the policy every earlier call, across runs', async () => {
			const seen: string[][] = [];
			const h = harness(
				server,
				[calls(call(name('lookup'), { id: '1' })), say('ok'), calls(call(name('catalogue.search'))), say('ok')],
				{
					approvalPolicy: ({ history }) => {
						seen.push(history.map(({ server, tool }) => `${server}/${tool}`));
						return 'allow';
					},
				},
			);
			await withHost(h, async (host) => {
				await host.run({ message: 'one' });
				await host.run({ message: 'two' });
				assert.deepEqual(seen, [[], ['test/lookup']]);
			});
		});

		test('an approval that times out counts as denied', async () => {
			const h = harness(server, [calls(call(name('lookup'), { id: '1' })), say('ok')], {
				approvalPolicy: () => 'ask',
				approvalTimeoutMs: 30,
			});
			await withHost(h, async (host) => {
				await host.run({ message: 'go' });
				const [required] = h.of('approval_required');
				assert.equal(outputs(host.state().items)[0]?.output, TOOL_MESSAGES.denied);
				assert.equal(h.of('approval_answered')[0]?.timedOut, true);
				assert.equal(host.respond(required?.id ?? '', { approve: true }), 'timed_out');
			});
		});

		test('passes a server confirmation to the consumer, and its answer to the server', async () => {
			const h = harness(server, [calls(call(name('confirm'))), say('ok')]);
			h.on((event, host) => {
				if (event.type === 'input_required') {
					host.respond(event.questionId, { action: 'accept', content: { confirm: true } });
				}
			});
			await withHost(h, async (host) => {
				await host.run({ message: 'go' });
				const [required] = h.of('input_required');
				assert.deepEqual(
					[required?.questionId, required?.server, required?.message],
					['call-1/1/confirm', 'test', 'Run it?'],
				);
				assert.equal(h.of('input_answered')[0]?.timedOut, false);
				assert.equal(outputs(host.state().items)[0]?.output, 'ran');
			});
		});

		test('a confirmation that times out is answered cancel', async () => {
			const h = harness(server, [calls(call(name('confirm'))), say('ok')], { confirmations: { timeoutMs: 30 } });
			await withHost(h, async (host) => {
				await host.run({ message: 'go' });
				const [answered] = h.of('input_answered');
				assert.deepEqual([answered?.answer, answered?.timedOut], [{ action: 'cancel' }, true]);
				assert.equal(outputs(host.state().items)[0]?.output, 'not confirmed');
				assert.equal(host.respond(answered?.questionId ?? '', { action: 'accept' }), 'timed_out');
			});
		});

		test('without confirmations, the server is never asked to confirm', async () => {
			const h = harness(server, [calls(call(name('confirm'))), say('ok')], { confirmations: false });
			await withHost(h, async (host) => {
				await host.run({ message: 'go' });
				assert.deepEqual(h.of('input_required'), []);
				assert.equal(h.of('tool_result')[0]?.outcome.outcome, 'rejected');
			});
		});
	});

	suite('cancellation and limits', () => {
		test('cancelling during a call cancels it, and stops the calls after it', async () => {
			const h = harness(server, [calls(call(name('slow')), call(name('lookup'), { id: '1' }))]);
			const controller = new AbortController();
			h.on((event) => {
				if (event.type === 'tool_call' && event.tool === 'slow') {
					setTimeout(() => controller.abort(), 100);
				}
			});
			await withHost(h, async (host) => {
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
			const h = harness(server, [calls(call(name('confirm')))]);
			const controller = new AbortController();
			h.on((event) => {
				if (event.type === 'input_required') {
					setTimeout(() => controller.abort(), 20);
				}
			});
			await withHost(h, async (host) => {
				const done = await host.run({ message: 'go' }, { signal: controller.signal });
				assert.equal(done.reason, 'cancelled');
				assert.equal(outputs(host.state().items)[0]?.output, TOOL_MESSAGES.cancelled);
				assert.deepEqual(host.pending(), []);
				assert.equal(host.respond('call-1/1/confirm', { action: 'accept' }), 'already_answered');
				assert.deepEqual(
					h.of('question_withdrawn').map(({ id, kind }) => [id, kind]),
					[['call-1/1/confirm', 'confirmation']],
				);
				assert.deepEqual(h.of('input_answered'), []);
			});
		});

		test('cancelling while the model generates ends the run without a model error', async () => {
			const h = harness(server, [{ hang: true }]);
			await withHost(h, async (host) => {
				const controller = new AbortController();
				setTimeout(() => controller.abort(), 20);
				const done = await host.run({ message: 'go' }, { signal: controller.signal });
				assert.equal(done.reason, 'cancelled');
				assert.deepEqual(h.of('model_error'), []);
				assert.equal(h.provider.requests.length, 1, 'nothing is sent after the cancellation');
			});
		});

		test('cancelling while an approval waits withdraws it, and the call never runs', async () => {
			const h = harness(server, [calls(call(name('lookup'), { id: '1' }))], { approvalPolicy: () => 'ask' });
			const controller = new AbortController();
			h.on((event) => {
				if (event.type === 'approval_required') {
					setTimeout(() => controller.abort(), 20);
				}
			});
			await withHost(h, async (host) => {
				const executedBefore = server.executed.length;
				const done = await host.run({ message: 'go' }, { signal: controller.signal });

				assert.equal(done.reason, 'cancelled');
				assert.equal(server.executed.length, executedBefore);
				assert.equal(outputs(host.state().items)[0]?.output, TOOL_MESSAGES.notRun);
				assert.deepEqual(host.pending(), []);
				assert.equal(host.respond('call-1/approval', { approve: true }), 'already_answered');
				assert.deepEqual(
					h.of('question_withdrawn').map(({ id, kind, callId }) => [id, kind, callId]),
					[['call-1/approval', 'approval', 'call-1']],
				);
				assert.deepEqual(h.of('approval_answered'), []);
			});
		});

		test('a state taken while a call is on the wire says its effect is unknown', async () => {
			const h = harness(server, [calls(call(name('slow')))]);
			const controller = new AbortController();
			let midCall: string | undefined;
			h.on((event, host) => {
				if (event.type === 'tool_call') {
					setTimeout(() => {
						midCall = outputs(host.state().items)[0]?.output;
						controller.abort();
					}, 50);
				}
			});
			await withHost(h, async (host) => {
				await host.run({ message: 'go' }, { signal: controller.signal });
				assert.equal(midCall, TOOL_MESSAGES.transportError);
			});
		});

		test('the tool-call limit ends the run, and later calls are not run', async () => {
			const h = harness(server, [calls(call(name('lookup'), { id: '1' }), call(name('lookup'), { id: '2' }))], {
				limits: { turns: 10, toolCalls: 1, wallClockMs: 30_000 },
			});
			await withHost(h, async (host) => {
				const done = await host.run({ message: 'go' });
				assert.equal(done.reason, 'tool_call_limit');
				assert.deepEqual(
					outputs(host.state().items).map(({ output }) => output),
					['found 1', TOOL_MESSAGES.notRun],
				);
			});
		});

		test('the turn limit ends the run with every call answered', async () => {
			const h = harness(server, [calls(call(name('lookup'), { id: '1' }))], {
				limits: { turns: 1, toolCalls: 10, wallClockMs: 30_000 },
			});
			await withHost(h, async (host) => {
				const done = await host.run({ message: 'go' });
				assert.equal(done.reason, 'turn_limit');
				assert.equal(h.provider.requests.length, 1);
				assert.equal(outputs(host.state().items).length, 1);
			});
		});

		test('the time limit ends the run, and a call it cut off is reported as of unknown effect', async () => {
			const h = harness(server, [calls(call(name('slow')))], {
				limits: { turns: 10, toolCalls: 10, wallClockMs: 200 },
			});
			await withHost(h, async (host) => {
				const done = await host.run({ message: 'go' });
				assert.equal(done.reason, 'time_limit');
				assert.equal(outputs(host.state().items)[0]?.output, TOOL_MESSAGES.transportError);
			});
		});
	});

	suite('model replies', () => {
		test('a model error ends the run without retrying, and the conversation stays valid', async () => {
			const error = { kind: 'http' as const, message: 'Bad gateway', status: 502, body: 'upstream' };
			const h = harness(server, [calls(call(name('lookup'), { id: '1' })), { error }]);
			await withHost(h, async (host) => {
				const done = await host.run({ message: 'go' });
				assert.equal(done.reason, 'model_error');
				assert.deepEqual(h.of('model_error')[0]?.error, error);
				assert.equal(h.provider.requests.length, 2);
				assert.equal(outputs(host.state().items).length, 1);
			});
		});

		test('a stream that ends without a response, or a provider that throws, is a model error', async () => {
			for (const [step, kind] of [
				[{ endEarly: true }, 'stream_ended'],
				[{ throws: 'socket hang up' }, 'unknown'],
			] as const) {
				const h = harness(server, [step]);
				await withHost(h, async (host) => {
					assert.equal((await host.run({ message: 'go' })).reason, 'model_error');
					assert.equal(h.of('model_error')[0]?.error.kind, kind);
				});
			}
		});

		test('an empty reply is retried once with a new seed, and kept out of the conversation', async () => {
			const h = harness(server, [say('', { usage: { inputTokens: 10, outputTokens: 40 } }), say('Hello')], {
				model: { model: 'm', temperature: 0, topP: 1, seed: 7, maxOutputTokens: 100 },
			});
			await withHost(h, async (host) => {
				const done = await host.run({ message: 'Hi' });
				assert.equal(done.reason, 'answered');
				assert.equal(done.totals.turns, 2, 'the retry counts as a turn');
				assert.deepEqual(
					h.provider.requests.map(({ seed }) => seed),
					[7, 8],
				);
				assert.deepEqual(h.provider.requests[1]?.messages, h.provider.requests[0]?.messages);
				const [empty] = h.of('empty_reply');
				assert.deepEqual([empty?.outputTokens, empty?.retrying], [40, true]);
				assert.equal(h.of('model_request')[1]?.retryOf, 'empty_reply');
				assert.equal(host.state().items.length, 2);
			});
		});

		test('a second empty reply, or one with retries off, ends the run', async () => {
			const twice = harness(server, [say(''), say('')]);
			await withHost(twice, async (host) => {
				assert.equal((await host.run({ message: 'Hi' })).reason, 'empty_reply');
				assert.deepEqual(
					twice.of('empty_reply').map(({ retrying }) => retrying),
					[true, false],
				);
			});

			const off = harness(server, [say('')], { retries: { emptyReply: false, outputLimit: false } });
			await withHost(off, async (host) => {
				assert.equal((await host.run({ message: 'Hi' })).reason, 'empty_reply');
				assert.equal(off.provider.requests.length, 1);
				assert.equal(off.of('empty_reply').length, 1, 'the event is kept either way');
			});
		});

		test('a reply cut off with no text is retried once, with a request-only nudge and less reasoning', async () => {
			const h = harness(
				server,
				[
					say('', { stopReason: 'length', reasoning: 'hmm', usage: { inputTokens: 5, outputTokens: 100 } }),
					say('Short'),
				],
				{},
				{ reduceReasoning: true },
			);
			await withHost(h, async (host) => {
				const done = await host.run({ message: 'Hi' });
				assert.equal(done.reason, 'answered');
				const retry = h.provider.requests[1];
				assert.deepEqual(retry?.messages.at(-1), userMessage(OUTPUT_LIMIT_RETRY_MESSAGE));
				assert.equal(retry?.extra?.reasoning_effort, 'low');
				assert.deepEqual(h.of('output_limit')[0]?.retrying, true);
				assert.deepEqual(
					host.state().items.map((item) => item.type === 'message' && item.text),
					['Hi', 'Short'],
				);
			});
		});

		test('a reply cut off with text keeps the text, marked, and ends the run', async () => {
			const h = harness(server, [say('The answer is', { stopReason: 'length' })]);
			await withHost(h, async (host) => {
				const done = await host.run({ message: 'Hi' });
				assert.equal(done.reason, 'output_limit');
				assert.equal(h.provider.requests.length, 1);
				const last = host.state().items.at(-1);
				assert.deepEqual(last?.type === 'message' && last.role === 'assistant' && [last.text, last.truncated], [
					'The answer is',
					true,
				]);
			});
		});

		test('an output-limit retry that comes back empty ends the run: one retry per step', async () => {
			const h = harness(server, [say('', { stopReason: 'length' }), say(''), say('never sent')]);
			await withHost(h, async (host) => {
				assert.equal((await host.run({ message: 'Hi' })).reason, 'empty_reply');
				assert.equal(h.provider.requests.length, 2);
				assert.deepEqual(
					h.of('empty_reply').map(({ retrying }) => retrying),
					[false],
				);
			});
		});

		test('a reply cut off twice ends the run', async () => {
			const h = harness(server, [say('', { stopReason: 'length' }), say('', { stopReason: 'length' })]);
			await withHost(h, async (host) => {
				assert.equal((await host.run({ message: 'Hi' })).reason, 'output_limit');
				assert.equal(h.provider.requests.length, 2);
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
			const probe = harness(server, []);
			let tokens = 0;
			await withHost(probe, async (host) => {
				tokens = await windowFor(host);
			});

			const h = harness(server, bigTwice(), { contextWindow: { tokens, policy: 'shorten', charsPerToken: 3 } });
			await withHost(h, async (host) => {
				const done = await host.run({ message: 'go' });
				assert.equal(done.reason, 'answered');
				const [shortened] = h.of('context_shortened');
				assert.deepEqual(shortened?.shortened, [{ callId: 'call-1', name: name('big') }]);
				assert.deepEqual(
					outputs(h.provider.requests[2]?.messages ?? []).map(({ output }) => output.length),
					[shortenedResult(name('big')).length, 3_000],
				);
				assert.deepEqual(
					outputs(host.state().items).map(({ output }) => output.length),
					[3_000, 3_000],
				);
			});
		});

		test('ends the run instead under the fail policy', async () => {
			const probe = harness(server, []);
			let tokens = 0;
			await withHost(probe, async (host) => {
				tokens = await windowFor(host);
			});

			const h = harness(server, bigTwice(), { contextWindow: { tokens, policy: 'fail', charsPerToken: 3 } });
			await withHost(h, async (host) => {
				const done = await host.run({ message: 'go' });
				assert.equal(done.reason, 'context_window');
				assert.equal(h.provider.requests.length, 2);
				assert.deepEqual(h.of('context_shortened'), []);
			});
		});

		test('ends the run when the server counts a longer prompt as shorter', async () => {
			const h = harness(server, [
				{
					response: {
						toolCalls: [call(name('lookup'), { id: '1' })],
						stopReason: 'tool_calls',
						usage: { inputTokens: 3_562, outputTokens: 5 },
					},
				},
				say('Answered without the question', { usage: { inputTokens: 3_494, outputTokens: 5 } }),
			]);
			await withHost(h, async (host) => {
				const done = await host.run({ message: 'go' });
				assert.equal(done.reason, 'context_window');
				assert.equal(h.of('model_error')[0]?.error.kind, 'truncated');
				assert.equal(host.state().items.at(-1)?.type, 'function_call_output', 'the answer is not kept');
			});
		});
	});

	suite('surfaces', () => {
		test('a collision at the start of a run fails it before any model call', () =>
			withServer({}, async (colliding) => {
				colliding.state.extraTools.push('dup.name', 'dup_name');
				const h = harness(colliding, [say('never')]);
				await withHost(h, async (host) => {
					const done = await host.run({ message: 'go' });
					assert.equal(done.reason, 'tool_collision');
					assert.match(done.detail ?? '', /dup\.name/);
					assert.equal(h.provider.requests.length, 0);
				});
			}));

		test('a collision found between turns leaves both tools out and is reported', () =>
			withServer({}, async (changing) => {
				const h = harness(changing, [calls(call(name('lookup'), { id: '1' })), say('ok')], {
					servers: [
						{
							key: 'test',
							trusted: true,
							connection: { url: changing.url },
							changeNotifications: true,
						},
					],
					approvalPolicy: () => 'ask',
				});
				h.on((event, host) => {
					if (event.type === 'approval_required') {
						changing.state.extraTools.push('x.y', 'x_y', 'added');
						// The listen stream is open by now; the SDK debounces changes for 300 ms.
						changing.notify.toolsChanged();
						setTimeout(() => host.respond(event.id, { approve: true }), 600);
					}
				});
				await withHost(h, async (host) => {
					await host.run({ message: 'go' });
					const [changed] = h.of('tools_changed');
					assert.deepEqual(
						changed?.leftOut.map(({ tool }) => tool),
						['x.y', 'x_y'],
					);
					const second = h.provider.requests[1]?.tools.map(({ name }) => name) ?? [];
					assert.ok(second.includes(name('added')));
					assert.ok(!second.includes(name('x.y')));
				});
			}));

		test('a server that cannot be re-read fails the run before any model call', () =>
			withServer({}, async (failing) => {
				const h = harness(failing, [say('never')]);
				await withHost(h, async (host) => {
					failing.state.failMethod = 'server/discover';
					const done = await host.run({ message: 'go' });
					assert.equal(done.reason, 'surface_error');
					assert.match(done.detail ?? '', /^test: /);
					assert.equal(h.provider.requests.length, 0);
				});
			}));

		test('a server that now advertises a new list is reconnected once', () =>
			withServer({}, async (growing) => {
				growing.state.prompts = false;
				const h = harness(growing, [say('ok')]);
				await withHost(h, async (host) => {
					growing.state.prompts = true;
					const done = await host.run({
						prompt: { server: 'test', name: 'start', arguments: { topic: 'x' } },
					});
					assert.equal(done.reason, 'answered');
				});
			}));
	});

	suite('prompts', () => {
		test("starts a run from a trusted server's prompt, with its roles", async () => {
			const h = harness(server, [say('ok')]);
			await withHost(h, async (host) => {
				const done = await host.run({
					prompt: { server: 'test', name: 'start', arguments: { topic: 'mice' } },
				});
				assert.equal(done.reason, 'answered');
				assert.deepEqual(
					h.provider.requests[0]?.messages.map(
						(item) => item.type === 'message' && `${item.role}: ${item.text}`,
					),
					['user: Tell me about mice', 'assistant: I will look it up.', 'user: Go ahead.'],
				);
			});
		});

		test("refuses an untrusted server's prompt before any model call", async () => {
			const h = harness(server, [say('never')], {
				servers: [{ key: 'test', connection: { url: server.url } }],
			});
			await withHost(h, async (host) => {
				const done = await host.run({ prompt: { server: 'test', name: 'start', arguments: { topic: 'x' } } });
				assert.equal(done.reason, 'prompt_failed');
				assert.match(done.detail ?? '', /not trusted/);
				assert.equal(h.provider.requests.length, 0);
			});
		});

		test('a prompt that cannot be fetched ends the run before any model call', async () => {
			const h = harness(server, [say('never')]);
			await withHost(h, async (host) => {
				const done = await host.run({ prompt: { server: 'test', name: 'missing' } });
				assert.equal(done.reason, 'prompt_failed');
				assert.equal(h.provider.requests.length, 0);
			});
		});
	});

	suite('conversation state', () => {
		test('a state saved while a confirmation waits is restored with the call abandoned', async () => {
			const h = harness(server, [calls(call(name('confirm')))]);
			let saved: unknown;
			const controller = new AbortController();
			h.on((event, host) => {
				if (event.type === 'input_required') {
					saved = JSON.parse(JSON.stringify(host.state()));
					controller.abort();
				}
			});
			await withHost(h, async (host) => {
				await host.run({ message: 'go' }, { signal: controller.signal });
			});

			const restored = harness(server, [calls(call(name('lookup'), { id: '2' })), say('ok')], { state: saved });
			await withHost(restored, async (host) => {
				assert.deepEqual(
					outputs(host.state().items).map(({ output }) => output),
					[TOOL_MESSAGES.abandoned],
				);
				const done = await host.run({ message: 'try again' });
				assert.equal(done.reason, 'answered');
				assert.deepEqual(
					restored.of('tool_call').map(({ callId }) => callId),
					['call-2'],
					'call ids continue from the saved state',
				);
				assert.deepEqual(
					outputs(restored.provider.requests[0]?.messages ?? []).map(({ output }) => output),
					[TOOL_MESSAGES.abandoned],
				);
			});
		});

		test('a saved state continues the conversation in a new host', async () => {
			const first = harness(server, [say('Hello')]);
			let saved: unknown;
			await withHost(first, async (host) => {
				await host.run({ message: 'Hi' });
				saved = JSON.parse(JSON.stringify(host.state()));
			});

			const second = harness(server, [say('Again')], { state: saved });
			await withHost(second, async (host) => {
				await host.run({ message: 'More' });
				assert.deepEqual(
					second.provider.requests[0]?.messages.map((item) => item.type === 'message' && item.text),
					['Hi', 'Hello', 'More'],
				);
			});
		});
	});

	suite('create', () => {
		test('refuses duplicate server keys, and a missing policy', async () => {
			const h = harness(server, []);
			await assert.rejects(
				McpHost.create({ ...h.options, servers: [...h.options.servers, ...h.options.servers] }),
				TypeError,
			);
			await assert.rejects(McpHost.create({ ...h.options, approvalPolicy: undefined as never }), TypeError);
		});

		test('refuses a timeout a Node timer cannot hold, or one that is not finite', async () => {
			const h = harness(server, []);
			const tooLong = 2 ** 31;
			for (const options of [
				{ limits: { ...h.options.limits, wallClockMs: tooLong } },
				{ limits: { ...h.options.limits, wallClockMs: Number.POSITIVE_INFINITY } },
				{ approvalTimeoutMs: tooLong },
				{ approvalTimeoutMs: 0 },
				{ confirmations: { timeoutMs: Number.NaN } },
			]) {
				await assert.rejects(McpHost.create({ ...h.options, ...options }), TypeError, JSON.stringify(options));
			}
		});

		test('fails, closing what it opened, when a server cannot be reached', async () => {
			const closes = mock.method(McpClient.prototype, 'close');
			try {
				const h = harness(server, [], {
					servers: [
						{ key: 'test', connection: { url: server.url } },
						{ key: 'gone', connection: { url: 'http://127.0.0.1:9/mcp' } },
					],
				});
				await assert.rejects(McpHost.create(h.options));
				assert.equal(closes.mock.callCount(), 1, 'the server that connected is closed');
			} finally {
				closes.mock.restore();
			}
		});
	});

	suite('data crossing inputs', () => {
		/** A saved conversation whose one server, `test`, returned restricted data. */
		const restrictedState = () => {
			const state = emptyState([{ key: 'test', ...identifyEndpoint(server.url), containsOnlyOpenData: false }]);
			return { ...state, servers: [{ ...state.servers[0], returnedData: 'restricted' }] };
		};

		/** A harness whose one server the person attests holds only open-access data. */
		const openData = (h: Harness) => {
			h.options.servers = [
				{ key: 'test', trusted: true, containsOnlyOpenData: true, connection: { url: server.url } },
			];
		};

		test('treats a server as restricted unless the person flags it', async () => {
			const seen: ApprovalRequest[] = [];
			const h = harness(
				server,
				[calls(call(name('lookup'), { id: '1' })), calls(call(name('catalogue.search'))), say('ok')],
				{
					approvalPolicy: (request) => {
						seen.push(request);
						return 'allow';
					},
				},
			);
			await withHost(h, async (host) => {
				await host.run({ message: 'go' });

				assert.equal(seen[0]?.call.containsOnlyOpenData, false);
				assert.deepEqual(seen[0]?.connections, [
					{
						key: 'test',
						...identifyEndpoint(server.url),
						containsOnlyOpenData: false,
						returnedData: 'none',
					},
				]);
				assert.deepEqual(seen[1]?.history, [
					{ callId: 'call-1', server: 'test', tool: 'lookup', containsOnlyOpenData: false },
				]);
				assert.deepEqual(seen[1]?.connections, [
					{
						key: 'test',
						...identifyEndpoint(server.url),
						containsOnlyOpenData: false,
						returnedData: 'restricted',
					},
				]);
				assert.equal(holdsRestrictedData(host.state().servers), true);
				assert.equal(h.of('run_started')[0]?.servers[0]?.containsOnlyOpenData, false);
			});
		});

		test("records a flagged server's data as unrestricted, and shows the policy the flag", async () => {
			const seen: ApprovalRequest[] = [];
			const h = harness(server, [calls(call(name('lookup'), { id: '1' })), say('ok')], {
				approvalPolicy: (request) => {
					seen.push(request);
					return 'allow';
				},
			});
			openData(h);
			await withHost(h, async (host) => {
				await host.run({ message: 'go' });

				assert.equal(seen[0]?.call.containsOnlyOpenData, true);
				assert.equal(host.state().servers[0]?.returnedData, 'unrestricted');
				assert.equal(holdsRestrictedData(host.state().servers), false);
				assert.equal(h.of('run_started')[0]?.servers[0]?.containsOnlyOpenData, true);
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
				const h = harness(server, [calls(call(tool)), say('ok')]);
				await withHost(h, async (host) => {
					await host.run({ message: 'go' });
					assert.equal(host.state().servers[0]?.returnedData, expected, tool);
				});
			}
		});

		test('marks a fetched prompt as returned data', async () => {
			const h = harness(server, [say('ok')]);
			await withHost(h, async (host) => {
				await host.run({ prompt: { server: 'test', name: 'start', arguments: { topic: 'x' } } });
				assert.equal(host.state().servers[0]?.returnedData, 'restricted');
			});
		});

		test('a refusal does not run the call, and names the server and why', async () => {
			const reason = 'this conversation holds data from another server';
			const h = harness(server, [calls(call(name('lookup'), { id: '1' })), say('ok')], {
				approvalPolicy: () => ({ refuse: reason }),
			});
			await withHost(h, async (host) => {
				const executedBefore = server.executed.length;
				await host.run({ message: 'go' });
				assert.equal(server.executed.length, executedBefore);
				assert.equal(outputs(host.state().items)[0]?.output, crossingRefusedMessage('test', reason));
				assert.deepEqual(h.of('tool_result')[0]?.outcome, {
					outcome: 'crossing_refused',
					server: 'test',
					reason,
				});
			});
		});

		test('refuses to restore a conversation holding restricted data with any server added, flagged or not', async () => {
			const saved = restrictedState();
			for (const containsOnlyOpenData of [false, true]) {
				const h = harness(server, [], {
					state: saved,
					servers: [
						{ key: 'test', connection: { url: server.url } },
						{ key: 'other', containsOnlyOpenData, connection: { url: server.url } },
					],
				});
				await assert.rejects(h.create(), ServerSetError);
			}
		});

		test('never loosens on restore: flagging a server later leaves its earlier data restricted', async () => {
			const saved = restrictedState();
			const h = harness(server, [], { state: saved });
			openData(h);
			await withHost(h, async (host) => {
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
			const h = harness(server, [], {
				servers: [{ key: 'test', containsOnlyOpenData: 'yes', connection: { url: server.url } } as never],
			});
			await assert.rejects(h.create(), TypeError);
		});

		test('denied, refused, cancelled and failed calls mark nothing as returned', async () => {
			const cases: [string, Partial<McpHostOptions>, (failing: TestServer) => void][] = [
				['denied', { approvalPolicy: () => 'deny' }, () => undefined],
				['refused', { approvalPolicy: () => ({ refuse: 'no' }) }, () => undefined],
				['transport_error', {}, (failing) => (failing.state.failMethod = 'tools/call')],
			];
			for (const [label, overrides, arrange] of cases) {
				await withServer({}, async (failing) => {
					const h = harness(failing, [calls(call(name('lookup'), { id: '1' })), say('ok')], overrides);
					await withHost(h, async (host) => {
						arrange(failing);
						await host.run({ message: 'go' });
						assert.equal(host.state().servers[0]?.returnedData, 'none', label);
					});
				});
			}

			const cancelling = harness(server, [calls(call(name('slow')))]);
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

		test('refuses to restore a conversation holding carried content with a server added', async () => {
			const first = harness(server, [say('ok')]);
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
				saved = JSON.parse(JSON.stringify(host.state()));
			});
			assert.equal((saved as { carried: unknown[] }).carried.length, 1);

			const widened = harness(server, [], {
				state: saved,
				servers: [
					{ key: 'test', connection: { url: server.url } },
					{ key: 'cbio', connection: { url: server.url } },
				],
			});
			await assert.rejects(widened.create(), ServerSetError);
		});

		test('treats a key reused for another server as a server added', () =>
			withServer({}, async (other) => {
				const moved = harness(server, [], {
					state: restrictedState(),
					servers: [{ key: 'test', connection: { url: other.url } }],
				});
				await assert.rejects(moved.create(), ServerSetError);

				const open = emptyState([
					{ key: 'test', ...identifyEndpoint(server.url), containsOnlyOpenData: false },
				]);
				const reused = harness(other, [], {
					state: open,
					servers: [{ key: 'test', connection: { url: other.url } }],
				});
				await withHost(reused, async (host) => {
					assert.equal(host.state().servers[0]?.endpointDigest, identifyEndpoint(other.url).endpointDigest);
				});
			}));

		test('shows the policy what the person carried in', async () => {
			const seen: ApprovalRequest[] = [];
			const h = harness(server, [calls(call(name('lookup'), { id: '1' })), say('ok')], {
				approvalPolicy: (request) => {
					seen.push(request);
					return 'allow';
				},
			});
			await withHost(h, async (host) => {
				await host.run({
					message: 'go',
					carried: { text: 'x', from: { server: 'overture' }, carriedAt: '2026-10-27T10:00:00.000Z' },
				});
				assert.deepEqual(seen[0]?.carried, [
					{ from: { server: 'overture' }, carriedAt: '2026-10-27T10:00:00.000Z' },
				]);
			});
		});
	});

	suite('carried content', () => {
		const carried = {
			text: 'BRCA1 c.68_69delAG',
			from: { server: 'overture', name: 'Overture' },
			carriedAt: '2026-10-26T14:02:00.000Z',
		};

		test('starts the conversation labelled as server text, and records the crossing', async () => {
			const h = harness(server, [say('ok')]);
			await withHost(h, async (host) => {
				await host.run({ message: 'Look these up', carried });

				assert.deepEqual(h.provider.requests[0]?.messages, [
					userMessage(`${carriedLabel('overture')}\n${carried.text}`),
					userMessage('Look these up'),
				]);
				const [event] = h.of('content_carried');
				assert.deepEqual(
					[event?.text, event?.from, event?.to, event?.carriedAt],
					[carried.text, carried.from, ['test'], carried.carriedAt],
				);
				assert.equal(host.state().servers[0]?.returnedData, 'none', "the person's own content marks nothing");
			});
		});

		test('is refused once the conversation has begun', async () => {
			const h = harness(server, [say('ok')]);
			await withHost(h, async (host) => {
				await host.run({ message: 'Hi' });
				await assert.rejects(host.run({ message: 'Now this', carried }), TypeError);
			});
		});
	});

	suite('reported context window', () => {
		test("uses the server's window when it is smaller than the configured one", async () => {
			const h = harness(server, [say('never')], {}, { contextWindow: 50 });
			await withHost(h, async (host) => {
				const done = await host.run({ message: 'Hi' });
				assert.equal(h.of('run_started')[0]?.reportedContextWindow, 50);
				assert.equal(done.reason, 'context_window');
				assert.match(done.detail ?? '', /50-token window/);
				assert.equal(h.provider.requests.length, 0);
			});
		});

		test('keeps the configured window when the server reports a larger one', async () => {
			const h = harness(server, [say('ok')], {}, { contextWindow: 10_000_000 });
			await withHost(h, async (host) => {
				assert.equal((await host.run({ message: 'Hi' })).reason, 'answered');
				assert.equal(h.of('run_started')[0]?.reportedContextWindow, 10_000_000);
			});
		});
	});

	suite('with the OpenAI-compatible provider', () => {
		test("runs a call end to end, and sends its result back under the model's call id", async () => {
			const model = await startModelServer();
			try {
				model.answer(async (request, response) => {
					const sent = request.body as { messages: { role: string }[] };
					const first = !sent.messages.some(({ role }) => role === 'tool');
					await writeStream(
						response,
						first
							? events(
									chunk({
										tool_calls: [
											{
												index: 0,
												id: 'call_x',
												function: { name: name('lookup'), arguments: '{"id":"9"}' },
											},
										],
									}),
									chunk({}, 'tool_calls'),
									usageChunk(200, 10),
								)
							: events(chunk({ content: 'Found it.' }), chunk({}, 'stop'), usageChunk(260, 4)),
					);
				});
				const h = harness(server, [], {
					provider: new OpenAiCompatibleProvider({ baseUrl: model.url }),
				});
				await withHost(h, async (host) => {
					const done = await host.run({ message: 'Find 9' });

					assert.equal(done.reason, 'answered');
					assert.deepEqual(done.totals, { ...done.totals, turns: 2, inputTokens: 460, outputTokens: 14 });
					const second = model.requests[1]?.body as { messages: Record<string, unknown>[] };
					assert.deepEqual(second.messages.slice(-2), [
						{
							role: 'assistant',
							content: null,
							tool_calls: [
								{
									id: 'call_x',
									type: 'function',
									function: { name: name('lookup'), arguments: '{"id":"9"}' },
								},
							],
						},
						{ role: 'tool', tool_call_id: 'call_x', content: 'found 9' },
					]);
					assert.deepEqual(
						h.of('token').map(({ text }) => text),
						['Found it.'],
					);
				});
			} finally {
				await model.close();
			}
		});
	});
});
