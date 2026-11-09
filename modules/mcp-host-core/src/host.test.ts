import assert from 'node:assert/strict';
import { after, before, mock, suite, test } from 'node:test';

import { InsecureTransportError, McpClient } from '@overture-stack/arranger-mcp-client';

import { createHarness, name, outputs, withHost, withServer } from '#testing/harness.js';
import { chunk, events, startModelServer, usageChunk, writeStream } from '#testing/modelServer.js';
import { call, calls, say } from '#testing/scriptedProvider.js';
import { LONG_TOOL_NAME, startTestServer, type TestServer } from '#testing/server.js';

import { McpHost, RunActiveError } from './host.js';
import { userMessage } from './messages.js';
import { OpenAiCompatibleProvider } from './providers/openAiCompatible.js';
import { instructionsHeading, reduceToolName } from './registry.js';
import { carriedLabel } from './run.js';
import { TOOL_MESSAGES } from './toolMessages.js';

import { InsecureTransportError as ExportedInsecureTransportError } from './index.js';

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
			const harness = createHarness(
				server,
				[{ deltas: ['Hel', 'lo'], response: { text: 'Hello', stopReason: 'stop' } }],
				{},
				{ digest: 'sha256:abc' },
			);
			await withHost(harness, async (host) => {
				const done = await host.run({ message: 'Hi' });

				assert.equal(done.reason, 'answered');
				assert.deepEqual(
					harness.events.map(({ type }) => type),
					['run_started', 'model_request', 'token', 'token', 'model_response', 'done'],
				);
				assert.deepEqual(
					harness.events.map(({ seq }) => seq),
					[0, 1, 2, 3, 4, 5],
				);
				assert.equal(new Set(harness.events.map(({ runId }) => runId)).size, 1);
				const [started] = harness.of('run_started');
				assert.equal(started?.modelDigest, 'sha256:abc');
				assert.equal(started?.providerUrl, harness.provider.url);
				assert.equal(started?.servers[0]?.server?.name, 'mcp-host-core-test-server');
				assert.match(started?.servers[0]?.hash ?? '', /^[0-9a-f]{64}$/);
				assert.deepEqual(
					host.state().items.map((item) => item.type === 'message' && `${item.role}: ${item.text}`),
					['user: Hi', 'assistant: Hello'],
				);
			});
		});

		test('sends the trusted server instructions, every tool, and the model settings', async () => {
			const harness = createHarness(server, [say('ok')], {
				systemPrompt: 'Be brief.',
				model: { model: 'm', temperature: 0.2, topP: 0.9, seed: 4, maxOutputTokens: 50, extra: { top_k: 1 } },
			});
			await withHost(harness, async (host) => {
				await host.run({ message: 'Hi' });

				const [request] = harness.provider.requests;
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
			const harness = createHarness(server, [say('ok')], {
				servers: [{ key: 'test', connection: { url: server.url } }],
			});
			await withHost(harness, async (host) => {
				await host.run({ message: 'Hi' });
				assert.equal(harness.provider.requests[0]?.systemPrompt, '');
			});
		});

		test('routes calls through the registry, one at a time, and sends each tool message back', async () => {
			const harness = createHarness(server, [
				calls(
					call(name('lookup'), { id: '7' }, 'model-a'),
					call(name('catalogue.search')),
					call(reduceToolName('test', LONG_TOOL_NAME)),
				),
				say('done'),
			]);
			await withHost(harness, async (host) => {
				const executedBefore = server.executed.length;
				const done = await host.run({ message: 'Find 7' });

				assert.equal(done.reason, 'answered');
				assert.deepEqual(server.executed.slice(executedBefore), ['lookup', 'catalogue.search', LONG_TOOL_NAME]);
				assert.deepEqual(
					harness.of('tool_call').map(({ callId, tool, modelCallId }) => [callId, tool, modelCallId]),
					[
						['call-1', 'lookup', 'model-a'],
						['call-2', 'catalogue.search', undefined],
						['call-3', LONG_TOOL_NAME, undefined],
					],
				);
				assert.deepEqual(
					outputs(harness.provider.requests[1]?.messages ?? []).map(({ output }) => output),
					['found 7', 'searched', 'long'],
				);
				assert.deepEqual(done.totals.toolCalls, 3);
			});
		});

		test('model_request is followed by exactly one model_response or model_error, or by done when stopped', async () => {
			const harness = createHarness(server, [
				say('ok'),
				{ error: { kind: 'http', message: 'The model server answered 500', status: 500 } },
				{ hang: true },
			]);
			const controller = new AbortController();
			harness.on((event) => {
				if (event.type === 'model_request' && event.turn === 1 && harness.of('model_request').length === 3) {
					setTimeout(() => controller.abort(), 20);
				}
			});
			await withHost(harness, async (host) => {
				await host.run({ message: 'replies' });
				await host.run({ message: 'fails' });
				await host.run({ message: 'stopped' }, { signal: controller.signal });
			});

			const pairing = harness.events
				.filter(({ type }) => ['model_request', 'model_response', 'model_error', 'done'].includes(type))
				.map((event) => (event.type === 'done' ? `done:${event.reason}` : event.type));
			assert.deepEqual(pairing, [
				'model_request',
				'model_response',
				'done:answered',
				'model_request',
				'model_error',
				'done:model_error',
				'model_request',
				'done:cancelled',
			]);
		});

		test('a model_response can be followed by a truncated model_error for the same request', async () => {
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
				await host.run({ message: 'go' });
			});

			const pairing = harness.events
				.filter(({ type }) => ['model_request', 'model_response', 'model_error', 'done'].includes(type))
				.map((event) => {
					if (event.type === 'done') {
						return `done:${event.reason}`;
					}
					if (event.type === 'model_error') {
						return `model_error:${event.error.kind}:${event.turn}`;
					}
					return event.type === 'model_request' || event.type === 'model_response'
						? `${event.type}:${event.turn}`
						: event.type;
				});
			assert.deepEqual(pairing, [
				'model_request:1',
				'model_response:1',
				'model_request:2',
				'model_response:2',
				'model_error:truncated:2',
				'done:context_window',
			]);
		});

		test('refuses a second run while one is active', async () => {
			const harness = createHarness(server, [{ hang: true }]);
			await withHost(harness, async (host) => {
				const controller = new AbortController();
				const first = host.run({ message: 'one' }, { signal: controller.signal });

				await assert.rejects(host.run({ message: 'two' }), RunActiveError);
				controller.abort();
				assert.equal((await first).reason, 'cancelled');
			});
		});

		test('lets a listener start the next run from done', async () => {
			const harness = createHarness(server, [say('one'), say('two')]);
			let next: Promise<unknown> | undefined;
			harness.on((event, host) => {
				if (event.type === 'done' && !next) {
					next = host.run({ message: 'again' });
				}
			});
			await withHost(harness, async (host) => {
				await host.run({ message: 'Hi' });
				const second = await next;
				assert.equal((second as { reason: string }).reason, 'answered');
				assert.equal(harness.provider.requests.length, 2);
			});
		});

		test('keeps every event plain data', async () => {
			const harness = createHarness(server, [calls(call(name('picture'))), say('ok')]);
			await withHost(harness, async (host) => {
				await host.run({ message: 'Hi' });
				for (const event of harness.events) {
					assert.deepEqual(JSON.parse(JSON.stringify(event)), event, event.type);
				}
			});
		});
	});

	suite('create', () => {
		test('refuses duplicate server keys, and a missing policy', async () => {
			const harness = createHarness(server, []);
			await assert.rejects(
				McpHost.create({
					...harness.options,
					servers: [...harness.options.servers, ...harness.options.servers],
				}),
				TypeError,
			);
			await assert.rejects(McpHost.create({ ...harness.options, approvalPolicy: undefined as never }), TypeError);
		});

		test('refuses a timeout a Node timer cannot hold, or one that is not finite', async () => {
			const harness = createHarness(server, []);
			const tooLong = 2 ** 31;
			for (const options of [
				{ limits: { ...harness.options.limits, wallClockMs: tooLong } },
				{ limits: { ...harness.options.limits, wallClockMs: Number.POSITIVE_INFINITY } },
				{ approvalTimeoutMs: tooLong },
				{ approvalTimeoutMs: 0 },
				{ confirmations: { timeoutMs: Number.NaN } },
			]) {
				await assert.rejects(
					McpHost.create({ ...harness.options, ...options }),
					TypeError,
					JSON.stringify(options),
				);
			}
		});

		test('refuses a reply cap that is not a positive whole number', async () => {
			const harness = createHarness(server, []);
			for (const maxOutputTokens of [0, -1, 1.5, Number.NaN]) {
				await assert.rejects(
					McpHost.create({ ...harness.options, model: { ...harness.options.model, maxOutputTokens } }),
					TypeError,
					String(maxOutputTokens),
				);
			}
		});

		test('refuses a reply cap that leaves no room in the window', async () => {
			const harness = createHarness(server, [], { contextWindow: { tokens: 1_000, policy: 'shorten' } });
			for (const maxOutputTokens of [1_000, 1_001]) {
				await assert.rejects(
					McpHost.create({ ...harness.options, model: { ...harness.options.model, maxOutputTokens } }),
					{
						name: 'TypeError',
						message: `model.maxOutputTokens (${maxOutputTokens}) must be less than contextWindow.tokens (1000), or no request fits`,
					},
					String(maxOutputTokens),
				);
			}
			const fits = await McpHost.create({
				...harness.options,
				model: { ...harness.options.model, maxOutputTokens: 999 },
			});
			await fits.close();
		});

		test('refuses model settings the provider refuses, before connecting anything', async () => {
			const connects = mock.method(McpClient, 'connect');
			try {
				const harness = createHarness(server, []);
				await assert.rejects(
					McpHost.create({
						...harness.options,
						provider: new OpenAiCompatibleProvider({ baseUrl: 'http://127.0.0.1:9/v1' }),
						model: { ...harness.options.model, extra: { seed: 1 } },
					}),
					{ name: 'TypeError', message: /seed \(use `model\.seed`\)/ },
				);
				assert.equal(connects.mock.callCount(), 0);
			} finally {
				connects.mock.restore();
			}
		});

		test("refuses a server's credential over plain HTTP, before connecting any server", async () => {
			const connects = mock.method(McpClient, 'connect');
			try {
				const harness = createHarness(server, [], {
					servers: [
						{ key: 'test', containsOnlyOpenData: true, connection: { url: server.url } },
						{
							key: 'remote',
							containsOnlyOpenData: true,
							connection: {
								url: 'http://mcp.example.test/mcp',
								auth: { headers: { authorization: 'Bearer x' } },
							},
						},
					],
				});
				await assert.rejects(McpHost.create(harness.options), InsecureTransportError);
				assert.equal(
					InsecureTransportError,
					ExportedInsecureTransportError,
					'the index re-exports the same class',
				);
				assert.equal(connects.mock.callCount(), 0);
			} finally {
				connects.mock.restore();
			}
		});

		test('fails, closing what it opened, when a server cannot be reached', async () => {
			const closes = mock.method(McpClient.prototype, 'close');
			try {
				const harness = createHarness(server, [], {
					servers: [
						{ key: 'test', containsOnlyOpenData: true, connection: { url: server.url } },
						{ key: 'gone', containsOnlyOpenData: true, connection: { url: 'http://127.0.0.1:9/mcp' } },
					],
				});
				await assert.rejects(McpHost.create(harness.options));
				assert.equal(closes.mock.callCount(), 1, 'the server that connected is closed');
			} finally {
				closes.mock.restore();
			}
		});
	});

	suite('conversation state', () => {
		test('a state saved while a confirmation waits is restored with the call abandoned', async () => {
			const harness = createHarness(server, [calls(call(name('confirm')))]);
			let saved: unknown;
			const controller = new AbortController();
			harness.on((event, host) => {
				if (event.type === 'input_required') {
					saved = JSON.parse(JSON.stringify(host.state()));
					controller.abort();
				}
			});
			await withHost(harness, async (host) => {
				await host.run({ message: 'go' }, { signal: controller.signal });
			});

			const restored = createHarness(server, [calls(call(name('lookup'), { id: '2' })), say('ok')], {
				state: saved,
			});
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
			const first = createHarness(server, [say('Hello')]);
			let saved: unknown;
			await withHost(first, async (host) => {
				await host.run({ message: 'Hi' });
				saved = JSON.parse(JSON.stringify(host.state()));
			});

			const second = createHarness(server, [say('Again')], { state: saved });
			await withHost(second, async (host) => {
				await host.run({ message: 'More' });
				assert.deepEqual(
					second.provider.requests[0]?.messages.map((item) => item.type === 'message' && item.text),
					['Hi', 'Hello', 'More'],
				);
			});
		});
	});

	suite('surfaces', () => {
		test('a collision at the start of a run fails it before any model call', () =>
			withServer({}, async (colliding) => {
				colliding.state.extraTools.push('dup.name', 'dup_name');
				const harness = createHarness(colliding, [say('never')]);
				await withHost(harness, async (host) => {
					const done = await host.run({ message: 'go' });
					assert.equal(done.reason, 'tool_collision');
					assert.match(done.detail ?? '', /dup\.name/);
					assert.equal(harness.provider.requests.length, 0);
				});
			}));

		test('a collision found between turns leaves both tools out and is reported', () =>
			withServer({}, async (changing) => {
				const harness = createHarness(changing, [calls(call(name('lookup'), { id: '1' })), say('ok')], {
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
				harness.on((event, host) => {
					if (event.type === 'approval_required') {
						changing.state.extraTools.push('x.y', 'x_y', 'added');
						// The listen stream is open by now; the SDK debounces changes for 300 ms.
						changing.notify.toolsChanged();
						setTimeout(() => host.respond(event.id, { approve: true }), 600);
					}
				});
				await withHost(harness, async (host) => {
					await host.run({ message: 'go' });
					const [changed] = harness.of('tools_changed');
					assert.deepEqual(
						changed?.leftOut.map(({ tool }) => tool),
						['x.y', 'x_y'],
					);
					const second = harness.provider.requests[1]?.tools.map(({ name }) => name) ?? [];
					assert.ok(second.includes(name('added')));
					assert.ok(!second.includes(name('x.y')));
				});
			}));

		test('a server that cannot be re-read fails the run before any model call', () =>
			withServer({}, async (failing) => {
				const harness = createHarness(failing, [say('never')]);
				await withHost(harness, async (host) => {
					failing.state.failMethod = 'server/discover';
					const done = await host.run({ message: 'go' });
					assert.equal(done.reason, 'surface_error');
					assert.match(done.detail ?? '', /^test: /);
					assert.equal(harness.provider.requests.length, 0);
				});
			}));

		test('a server that now advertises a new list is reconnected once', () =>
			withServer({}, async (growing) => {
				growing.state.prompts = false;
				const harness = createHarness(growing, [say('ok')]);
				await withHost(harness, async (host) => {
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
			const harness = createHarness(server, [say('ok')]);
			await withHost(harness, async (host) => {
				const done = await host.run({
					prompt: { server: 'test', name: 'start', arguments: { topic: 'mice' } },
				});
				assert.equal(done.reason, 'answered');
				assert.deepEqual(
					harness.provider.requests[0]?.messages.map(
						(item) => item.type === 'message' && `${item.role}: ${item.text}`,
					),
					['user: Tell me about mice', 'assistant: I will look it up.', 'user: Go ahead.'],
				);
			});
		});

		test("refuses an untrusted server's prompt before any model call", async () => {
			const harness = createHarness(server, [say('never')], {
				servers: [{ key: 'test', connection: { url: server.url } }],
			});
			await withHost(harness, async (host) => {
				const done = await host.run({ prompt: { server: 'test', name: 'start', arguments: { topic: 'x' } } });
				assert.equal(done.reason, 'prompt_failed');
				assert.match(done.detail ?? '', /not trusted/);
				assert.equal(harness.provider.requests.length, 0);
			});
		});

		test('a prompt that cannot be fetched ends the run before any model call', async () => {
			const harness = createHarness(server, [say('never')]);
			await withHost(harness, async (host) => {
				const done = await host.run({ prompt: { server: 'test', name: 'missing' } });
				assert.equal(done.reason, 'prompt_failed');
				assert.equal(harness.provider.requests.length, 0);
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
			const harness = createHarness(server, [say('ok')]);
			await withHost(harness, async (host) => {
				await host.run({ message: 'Look these up', carried });

				assert.deepEqual(harness.provider.requests[0]?.messages, [
					userMessage(`${carriedLabel('overture')}\n${carried.text}`),
					userMessage('Look these up'),
				]);
				const [event] = harness.of('content_carried');
				assert.deepEqual(
					[event?.text, event?.from, event?.to, event?.carriedAt],
					[carried.text, carried.from, ['test'], carried.carriedAt],
				);
				assert.equal(host.state().servers[0]?.returnedData, 'none', "the person's own content marks nothing");
			});
		});

		test('is refused once the conversation has begun', async () => {
			const harness = createHarness(server, [say('ok')]);
			await withHost(harness, async (host) => {
				await host.run({ message: 'Hi' });
				await assert.rejects(host.run({ message: 'Now this', carried }), TypeError);
			});
		});
	});

	suite('reported context window', () => {
		test("uses the server's window when it is smaller than the configured one", async () => {
			const harness = createHarness(server, [say('never')], {}, { contextWindow: 50 });
			await withHost(harness, async (host) => {
				const done = await host.run({ message: 'Hi' });
				assert.equal(harness.of('run_started')[0]?.reportedContextWindow, 50);
				assert.equal(done.reason, 'context_window');
				assert.match(done.detail ?? '', /50-token window/);
				assert.equal(harness.provider.requests.length, 0);
			});
		});

		test('keeps the configured window when the server reports a larger one', async () => {
			const harness = createHarness(server, [say('ok')], {}, { contextWindow: 10_000_000 });
			await withHost(harness, async (host) => {
				assert.equal((await host.run({ message: 'Hi' })).reason, 'answered');
				assert.equal(harness.of('run_started')[0]?.reportedContextWindow, 10_000_000);
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
				const harness = createHarness(server, [], {
					provider: new OpenAiCompatibleProvider({ baseUrl: model.url }),
				});
				await withHost(harness, async (host) => {
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
						harness.of('token').map(({ text }) => text),
						['Found it.'],
					);
				});
			} finally {
				await model.close();
			}
		});
	});
});
