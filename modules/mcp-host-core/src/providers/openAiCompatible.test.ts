import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';

import { InsecureTransportError } from '@overture-stack/arranger-mcp-client';

import { chunk, events, type ModelServer, startModelServer, usageChunk, writeStream } from '#testing/modelServer.js';

import { assistantMessage, functionCall, functionCallOutput, userMessage } from '../messages.js';
import { type ProviderRequest, type ProviderStreamItem } from '../provider.js';

import { MAX_ERROR_BODY_CHARS, OpenAiCompatibleProvider, toWireMessages, toWireRequest } from './openAiCompatible.js';

const request = (overrides: Partial<ProviderRequest> = {}): ProviderRequest => ({
	model: 'test-model',
	temperature: 0,
	topP: 1,
	maxOutputTokens: 100,
	systemPrompt: 'Be brief.',
	messages: [userMessage('Hi')],
	tools: [],
	...overrides,
});

/** Runs one request and collects everything the provider yields. */
const collect = async (provider: OpenAiCompatibleProvider, req = request(), signal = new AbortController().signal) => {
	const items: ProviderStreamItem[] = [];
	for await (const item of provider.generate(req, signal)) {
		items.push(item);
	}
	return items;
};

const last = (items: ProviderStreamItem[]) => items.at(-1);

/** The kind of the error that ended a stream, if one did. */
const errorKind = (items: ProviderStreamItem[]) => {
	const final = items.at(-1);
	return final?.type === 'error' ? final.error.kind : undefined;
};

suite('OpenAiCompatibleProvider', () => {
	let model: ModelServer;

	before(async () => {
		model = await startModelServer();
	});

	after(async () => {
		await model.close();
	});

	suite('the request', () => {
		test('sends the settings, the tools and the conversation in Chat Completions form', async () => {
			model.answer((_request, response) => writeStream(response, events(chunk({ content: 'ok' }, 'stop'))));
			const provider = new OpenAiCompatibleProvider({ baseUrl: model.url, apiKey: 'secret-1' });
			const before = model.requests.length;

			await collect(
				provider,
				request({
					seed: 4,
					responseFormat: { type: 'object' },
					extra: { top_k: 1, temperature: 0.5 },
					tools: [{ name: 'mcp__s__lookup', description: 'Looks up', parameters: { type: 'object' } }],
				}),
			);

			const [sent] = model.requests.slice(before);
			assert.equal(sent?.path, '/v1/chat/completions');
			assert.equal(sent?.headers.authorization, 'Bearer secret-1');
			assert.deepEqual(sent?.body, {
				model: 'test-model',
				messages: [
					{ role: 'system', content: 'Be brief.' },
					{ role: 'user', content: 'Hi' },
				],
				tools: [
					{
						type: 'function',
						function: { name: 'mcp__s__lookup', description: 'Looks up', parameters: { type: 'object' } },
					},
				],
				temperature: 0.5,
				top_p: 1,
				seed: 4,
				max_tokens: 100,
				response_format: {
					type: 'json_schema',
					json_schema: { name: 'response', schema: { type: 'object' }, strict: true },
				},
				stream: true,
				stream_options: { include_usage: true },
				top_k: 1,
			});
		});

		test('lets `extra` override a sampling field, and drops every reserved field from it', () => {
			const body = toWireRequest(
				request({
					seed: 4,
					tools: [{ name: 't', parameters: { type: 'object' } }],
					extra: {
						model: 'other',
						messages: [],
						tools: [],
						stream: false,
						stream_options: { include_usage: false },
						n: 2,
						seed: 9,
						max_tokens: 1,
						max_completion_tokens: 9_999,
						temperature: 0.5,
						top_k: 1,
					},
				}),
				{ stream: true, sendReasoning: false },
			);

			assert.deepEqual(
				{ ...body, messages: (body.messages as unknown[]).length, tools: (body.tools as unknown[]).length },
				{
					model: 'test-model',
					messages: 2,
					tools: 1,
					temperature: 0.5,
					top_p: 1,
					seed: 4,
					max_tokens: 100,
					stream: true,
					stream_options: { include_usage: true },
					top_k: 1,
				},
			);
		});

		test('sends the reply cap in the configured field', async () => {
			model.answer((_request, response) => writeStream(response, events(chunk({ content: 'ok' }, 'stop'))));
			const before = model.requests.length;

			await collect(
				new OpenAiCompatibleProvider({ baseUrl: model.url, outputLimitField: 'max_completion_tokens' }),
			);

			const [sent] = model.requests.slice(before);
			const body = sent?.body as Record<string, unknown>;
			assert.equal(body.max_completion_tokens, 100);
			assert.equal('max_tokens' in body, false);
		});

		test('refuses settings whose `extra` sets a reserved field, naming what to use instead', () => {
			const provider = new OpenAiCompatibleProvider({ baseUrl: model.url });

			assert.throws(() => provider.assertSettings(request({ extra: { top_k: 1, seed: 1, max_tokens: 50 } })), {
				name: 'TypeError',
				message:
					"`model.extra` sets reserved fields: seed (use `model.seed`), max_tokens (use `model.maxOutputTokens`, and the provider's `outputLimitField`)",
			});
			assert.doesNotThrow(() => provider.assertSettings(request({ extra: { top_k: 1, toString: 'x' } })));
			assert.doesNotThrow(() => provider.assertSettings(request()));
		});

		test('refuses an `extra` that sets a reserved field, without sending anything', async () => {
			const before = model.requests.length;

			const items = await collect(
				new OpenAiCompatibleProvider({ baseUrl: model.url }),
				request({ extra: { top_k: 1, messages: [], n: 2, seed: 1, max_completion_tokens: 50 } }),
			);

			assert.deepEqual(items, [
				{
					type: 'error',
					error: {
						kind: 'unknown',
						message:
							"`model.extra` sets reserved fields: messages (host-core builds the conversation), n (only the first reply is read), seed (use `model.seed`), max_completion_tokens (use `model.maxOutputTokens`, and the provider's `outputLimitField`)",
					},
				},
			]);
			assert.equal(model.requests.length, before);
		});

		test('reports a request that cannot be serialized, without sending anything', async () => {
			const before = model.requests.length;

			const items = await collect(
				new OpenAiCompatibleProvider({ baseUrl: model.url }),
				request({ extra: { seed_big: 1n } }),
			);

			assert.equal(items.length, 1);
			assert.equal(errorKind(items), 'unknown');
			assert.equal(model.requests.length, before);
		});

		test("groups a turn's calls on its assistant message, and keys each result by the model's call id", () => {
			const messages = toWireMessages(
				'',
				[
					userMessage('q'),
					assistantMessage('Looking.', { reasoning: 'hmm' }),
					functionCall({ callId: 'call-1', modelCallId: 'm-1', name: 'a', arguments: '{"x":1}' }),
					functionCall({ callId: 'call-2', name: 'b', arguments: '{"x":' }),
					functionCallOutput('call-1', 'one', false),
					functionCallOutput('call-2', 'The call could not be parsed', true),
					functionCall({ callId: 'call-3', name: 'c', arguments: '{}' }),
					functionCallOutput('call-3', 'three', false),
				],
				false,
			);

			assert.deepEqual(messages, [
				{ role: 'user', content: 'q' },
				{
					role: 'assistant',
					content: 'Looking.',
					tool_calls: [
						{ id: 'm-1', type: 'function', function: { name: 'a', arguments: '{"x":1}' } },
						{
							id: 'call-2',
							type: 'function',
							function: { name: 'b', arguments: '{"unparsed":"{\\"x\\":"}' },
						},
					],
				},
				{ role: 'tool', tool_call_id: 'm-1', content: 'one' },
				{ role: 'tool', tool_call_id: 'call-2', content: 'The call could not be parsed' },
				{
					role: 'assistant',
					content: null,
					tool_calls: [{ id: 'call-3', type: 'function', function: { name: 'c', arguments: '{}' } }],
				},
				{ role: 'tool', tool_call_id: 'call-3', content: 'three' },
			]);
		});

		test('sends reasoning back only when configured to', () => {
			const items = [assistantMessage('Done.', { reasoning: 'hmm' })];
			assert.deepEqual(toWireMessages('', items, false), [{ role: 'assistant', content: 'Done.' }]);
			assert.deepEqual(toWireMessages('', items, true), [
				{ role: 'assistant', content: 'Done.', reasoning: 'hmm' },
			]);
		});

		test('asks for a key from the callback before every request', async () => {
			model.answer((_request, response) => writeStream(response, events(chunk({ content: 'ok' }, 'stop'))));
			let count = 0;
			const provider = new OpenAiCompatibleProvider({
				baseUrl: model.url,
				apiKey: async () => `token-${++count}`,
			});
			const before = model.requests.length;

			await collect(provider);
			await collect(provider);

			assert.deepEqual(
				model.requests.slice(before).map(({ headers }) => headers.authorization),
				['Bearer token-1', 'Bearer token-2'],
			);
		});

		test('reports a key callback that fails, without sending the request', async () => {
			const provider = new OpenAiCompatibleProvider({
				baseUrl: model.url,
				apiKey: async () => {
					throw new Error('keychain locked');
				},
			});
			const before = model.requests.length;

			const items = await collect(provider);

			assert.deepEqual(last(items), {
				type: 'error',
				error: { kind: 'unknown', message: 'The API key could not be read: keychain locked' },
			});
			assert.equal(model.requests.length, before);
		});

		test('needs a base URL', () => {
			assert.throws(() => new OpenAiCompatibleProvider({ baseUrl: '' }), TypeError);
			assert.throws(() => new OpenAiCompatibleProvider({ baseUrl: 'not a url' }), TypeError);
		});

		test('refuses an API key over plain HTTP to a host other than this machine', () => {
			const baseUrl = 'http://model.example.test/v1';
			for (const apiKey of ['secret', async () => 'secret']) {
				assert.throws(
					() => new OpenAiCompatibleProvider({ baseUrl, apiKey }),
					(error: unknown) =>
						error instanceof InsecureTransportError &&
						/^Refusing to send the API key over plain HTTP to model\.example\.test: /.test(error.message),
				);
			}
			assert.doesNotThrow(
				() => new OpenAiCompatibleProvider({ baseUrl, apiKey: 'secret', allowInsecureHttp: true }),
			);
			assert.doesNotThrow(() => new OpenAiCompatibleProvider({ baseUrl }));
			assert.doesNotThrow(() => new OpenAiCompatibleProvider({ baseUrl, apiKey: '' }));
			assert.doesNotThrow(
				() => new OpenAiCompatibleProvider({ baseUrl: 'https://model.example.test/v1', apiKey: 'secret' }),
			);
			for (const loopback of [
				'http://localhost:11434/v1',
				'http://127.0.0.1:11434/v1',
				'http://[::1]:11434/v1',
			]) {
				assert.doesNotThrow(() => new OpenAiCompatibleProvider({ baseUrl: loopback, apiKey: 'secret' }));
			}
		});

		test('refuses an output limit field it does not know', () => {
			assert.throws(
				() =>
					new OpenAiCompatibleProvider({
						baseUrl: model.url,
						outputLimitField: 'max_output_tokens' as 'max_tokens',
					}),
				TypeError,
			);
		});

		test('refuses max_completion_tokens for Ollama, which ignores it', () => {
			assert.throws(
				() =>
					new OpenAiCompatibleProvider({
						baseUrl: model.url,
						ollama: true,
						outputLimitField: 'max_completion_tokens',
					}),
				{ name: 'TypeError', message: /Ollama ignores max_completion_tokens/ },
			);
			assert.doesNotThrow(
				() =>
					new OpenAiCompatibleProvider({ baseUrl: model.url, ollama: true, outputLimitField: 'max_tokens' }),
			);
			assert.doesNotThrow(
				() => new OpenAiCompatibleProvider({ baseUrl: model.url, outputLimitField: 'max_completion_tokens' }),
			);
		});

		test('refuses a request timeout a Node timer cannot hold', () => {
			for (const requestTimeoutMs of [2 ** 31, Number.POSITIVE_INFINITY, 0, -1]) {
				assert.throws(() => new OpenAiCompatibleProvider({ baseUrl: model.url, requestTimeoutMs }), TypeError);
			}
		});

		test('says whether it sends reasoning back, for the context estimate', () => {
			assert.equal(new OpenAiCompatibleProvider({ baseUrl: model.url }).sendsReasoning, false);
			assert.equal(
				new OpenAiCompatibleProvider({ baseUrl: model.url, sendReasoning: true }).sendsReasoning,
				true,
			);
		});
	});

	suite('the stream', () => {
		test('reads only the first choice, when a server sends more than one', async () => {
			const choice = (index: number, delta: Record<string, unknown>, finishReason?: string) =>
				JSON.stringify({
					choices: [{ index, delta, ...(finishReason !== undefined && { finish_reason: finishReason }) }],
				});
			model.answer((_request, response) =>
				writeStream(
					response,
					events(
						choice(0, { content: 'First ' }),
						choice(1, { content: 'Second ' }),
						choice(0, {
							tool_calls: [{ index: 0, id: 'a', function: { name: 'search', arguments: '{}' } }],
						}),
						choice(1, {
							tool_calls: [{ index: 0, id: 'b', function: { name: 'count', arguments: '{}' } }],
						}),
						choice(1, {}, 'stop'),
						choice(0, {}, 'tool_calls'),
					),
				),
			);
			const final = last(await collect(new OpenAiCompatibleProvider({ baseUrl: model.url })));

			assert.equal(final?.type, 'response');
			if (final?.type === 'response') {
				assert.equal(final.response.text, 'First ');
				assert.deepEqual(final.response.toolCalls, [
					{ kind: 'call', id: 'a', name: 'search', arguments: '{}' },
				]);
				assert.equal(final.response.stopReason, 'tool_calls');
			}
		});

		test('yields text as it arrives, then the response with exact usage and the model id', async () => {
			model.answer((_request, response) =>
				writeStream(
					response,
					events(
						chunk({ role: 'assistant', content: 'Hel' }),
						chunk({ content: 'lo', reasoning: 'thinking' }),
						chunk({}, 'stop'),
						usageChunk(12, 3),
					),
				),
			);
			const items = await collect(new OpenAiCompatibleProvider({ baseUrl: model.url }));

			assert.deepEqual(
				items.filter(({ type }) => type === 'delta'),
				[
					{ type: 'delta', text: 'Hel' },
					{ type: 'delta', text: 'lo' },
				],
			);
			const final = last(items);
			assert.equal(final?.type, 'response');
			if (final?.type === 'response') {
				assert.equal(final.response.text, 'Hello');
				assert.equal(final.response.reasoning, 'thinking');
				assert.deepEqual(final.response.usage, { inputTokens: 12, outputTokens: 3, totalTokens: 15 });
				assert.equal(final.response.stopReason, 'stop');
				assert.equal(final.response.modelId, 'test-model');
			}
		});

		test('reassembles events and tool calls split anywhere across reads', async () => {
			const text = events(
				chunk({ tool_calls: [{ index: 0, id: 'call_a', function: { name: 'mcp__s__', arguments: '' } }] }),
				chunk({ tool_calls: [{ index: 0, function: { name: 'lookup', arguments: '{"id"' } }] }),
				chunk({ tool_calls: [{ index: 0, function: { arguments: ': "7"}' } }] }),
				chunk({ tool_calls: [{ index: 1, id: 'call_b', function: { name: 'mcp__s__other', arguments: '' } }] }),
				chunk({}, 'tool_calls'),
			).join('');
			// Pieces of 7 characters split `data:` prefixes, JSON strings and the blank lines between events.
			const pieces = text.match(/[\s\S]{1,7}/g) ?? [];
			model.answer((_request, response) => writeStream(response, pieces, 1));

			const final = last(await collect(new OpenAiCompatibleProvider({ baseUrl: model.url })));

			assert.equal(final?.type, 'response');
			if (final?.type === 'response') {
				assert.deepEqual(final.response.toolCalls, [
					{ kind: 'call', id: 'call_a', name: 'mcp__s__lookup', arguments: '{"id": "7"}' },
					{ kind: 'call', id: 'call_b', name: 'mcp__s__other', arguments: '{}' },
				]);
				assert.equal(final.response.stopReason, 'tool_calls');
			}
		});

		test('orders calls by their index, whatever it starts at and however they arrive', async () => {
			model.answer((_request, response) =>
				writeStream(
					response,
					events(
						chunk({
							tool_calls: [{ index: 3, id: 'later', function: { name: 'mcp__s__b', arguments: '{}' } }],
						}),
						chunk({
							tool_calls: [{ index: 1, id: 'first', function: { name: 'mcp__s__a', arguments: '{}' } }],
						}),
						chunk({}, 'tool_calls'),
					),
				),
			);
			const final = last(await collect(new OpenAiCompatibleProvider({ baseUrl: model.url })));

			assert.equal(final?.type, 'response');
			if (final?.type === 'response') {
				assert.deepEqual(
					final.response.toolCalls.map((call) => call.id),
					['first', 'later'],
				);
			}
		});

		test('reports arguments that are not a JSON object as a malformed call, with the raw text', async () => {
			model.answer((_request, response) =>
				writeStream(
					response,
					events(
						chunk({
							tool_calls: [{ index: 0, id: 'c1', function: { name: 'mcp__s__a', arguments: '{"id": ' } }],
						}),
						chunk({ tool_calls: [{ index: 1, id: 'c2', function: { name: '', arguments: '{}' } }] }),
						chunk({}, 'tool_calls'),
					),
				),
			);
			const final = last(await collect(new OpenAiCompatibleProvider({ baseUrl: model.url })));

			assert.equal(final?.type, 'response');
			if (final?.type === 'response') {
				assert.deepEqual(final.response.toolCalls, [
					{ kind: 'malformed', id: 'c1', name: 'mcp__s__a', raw: '{"id": ' },
					{ kind: 'malformed', id: 'c2', raw: '{}' },
				]);
			}
		});

		test('reports a stream that ends without a finish reason', async () => {
			model.answer((_request, response) => writeStream(response, events(chunk({ content: 'Partial' }))));
			const items = await collect(new OpenAiCompatibleProvider({ baseUrl: model.url }));

			assert.equal(errorKind(items), 'stream_ended');
		});

		test('reports an error the server sends inside the stream', async () => {
			model.answer((_request, response) =>
				writeStream(
					response,
					events(chunk({ content: 'a' }), JSON.stringify({ error: { message: 'overloaded' } })),
				),
			);
			const final = last(await collect(new OpenAiCompatibleProvider({ baseUrl: model.url })));

			assert.equal(final?.type === 'error' && final.error.kind, 'unknown');
			assert.match(final?.type === 'error' ? (final.error.body ?? '') : '', /overloaded/);
		});

		test('reports a refusal', async () => {
			model.answer((_request, response) =>
				writeStream(response, events(chunk({ refusal: 'I cannot help with that.' }), chunk({}, 'stop'))),
			);
			const final = last(await collect(new OpenAiCompatibleProvider({ baseUrl: model.url })));

			assert.deepEqual(final, { type: 'error', error: { kind: 'refusal', message: 'I cannot help with that.' } });
		});
	});

	suite('errors', () => {
		test('reports an HTTP error with its status and a bounded body', async () => {
			model.answer((_request, response) => {
				response.writeHead(500, { 'content-type': 'text/plain' }).end('x'.repeat(MAX_ERROR_BODY_CHARS * 2));
			});
			const final = last(await collect(new OpenAiCompatibleProvider({ baseUrl: model.url })));

			assert.equal(final?.type, 'error');
			if (final?.type === 'error') {
				assert.equal(final.error.kind, 'http');
				assert.equal(final.error.status, 500);
				assert.equal(final.error.body?.length, MAX_ERROR_BODY_CHARS);
			}
		});

		test('reports a redirect as its status, and never follows it', async () => {
			const elsewhere = await startModelServer();
			try {
				const target = new URL(`${elsewhere.url}/chat/completions?token=x#part`);
				target.username = 'user';
				target.password = 'secret';
				model.answer((_request, response) => {
					response.writeHead(307, { location: target.href }).end();
				});
				const final = last(await collect(new OpenAiCompatibleProvider({ baseUrl: model.url })));

				assert.equal(final?.type, 'error');
				if (final?.type === 'error') {
					assert.equal(final.error.kind, 'http');
					assert.equal(final.error.status, 307);
					assert.equal(
						final.error.message,
						`The model server answered 307 Temporary Redirect, to ${elsewhere.url}/chat/completions, which is not followed`,
					);
				}
				assert.equal(elsewhere.requests.length, 0);
			} finally {
				await elsewhere.close();
			}
		});

		test('suggests https when a plain HTTP base URL redirects to it', async () => {
			const https = new URL(model.url);
			https.protocol = 'https:';
			model.answer((_request, response) => {
				response.writeHead(308, { location: `${https.href}/chat/completions` }).end();
			});
			const final = last(await collect(new OpenAiCompatibleProvider({ baseUrl: model.url })));

			assert.equal(final?.type, 'error');
			if (final?.type === 'error') {
				assert.match(
					final.error.message,
					/^The model server answered 308 Permanent Redirect, to https:.*\. Use https in `baseUrl`$/,
				);
			}
		});

		test('reports a 401 once, and never retries', async () => {
			model.answer((_request, response) => {
				response.writeHead(401).end('{"error":"expired"}');
			});
			const provider = new OpenAiCompatibleProvider({ baseUrl: model.url, apiKey: async () => 'stale' });
			const before = model.requests.length;

			const final = last(await collect(provider));

			assert.deepEqual(final?.type === 'error' && [final.error.kind, final.error.status], ['http', 401]);
			assert.equal(model.requests.length - before, 1);
		});

		test('reports an abort mid-stream as aborted', async () => {
			model.answer((_request, response) =>
				writeStream(
					response,
					[...events(chunk({ content: 'a' })).slice(0, 1), ...Array(50).fill(': keep-alive\n\n')],
					20,
				),
			);
			const controller = new AbortController();
			const items: ProviderStreamItem[] = [];
			for await (const item of new OpenAiCompatibleProvider({ baseUrl: model.url }).generate(
				request(),
				controller.signal,
			)) {
				items.push(item);
				if (item.type === 'delta') {
					controller.abort();
				}
			}

			assert.deepEqual(last(items), {
				type: 'error',
				error: { kind: 'aborted', message: 'The request was aborted' },
			});
		});

		test('reports a server that does not answer in time', async () => {
			model.answer(() => {
				// Never answers.
			});
			const items = await collect(new OpenAiCompatibleProvider({ baseUrl: model.url, requestTimeoutMs: 50 }));

			assert.equal(errorKind(items), 'timeout');
		});

		test('reports a server that cannot be reached', async () => {
			const items = await collect(new OpenAiCompatibleProvider({ baseUrl: 'http://127.0.0.1:9/v1' }));
			assert.equal(errorKind(items), 'network');
		});
	});

	suite('without streaming', () => {
		test('reads the whole reply', async () => {
			model.answer((_request, response) => {
				response.writeHead(200, { 'content-type': 'application/json' }).end(
					JSON.stringify({
						model: 'test-model',
						choices: [
							{
								index: 0,
								finish_reason: 'tool_calls',
								message: {
									role: 'assistant',
									content: '',
									reasoning_content: 'plan',
									tool_calls: [
										{
											id: 'c1',
											type: 'function',
											function: { name: 'mcp__s__a', arguments: '{}' },
										},
									],
								},
							},
						],
						usage: { prompt_tokens: 7, completion_tokens: 2, total_tokens: 9 },
					}),
				);
			});
			const provider = new OpenAiCompatibleProvider({ baseUrl: model.url, stream: false });
			const before = model.requests.length;

			const items = await collect(provider);

			const sent = model.requests[before]?.body as Record<string, unknown>;
			assert.equal(sent.stream, false);
			assert.equal('stream_options' in sent, false);
			assert.deepEqual(items, [
				{
					type: 'response',
					response: {
						text: '',
						reasoning: 'plan',
						toolCalls: [{ kind: 'call', id: 'c1', name: 'mcp__s__a', arguments: '{}' }],
						usage: { inputTokens: 7, outputTokens: 2, totalTokens: 9 },
						stopReason: 'tool_calls',
						modelId: 'test-model',
						durationMs: items[0]?.type === 'response' ? items[0].response.durationMs : 0,
					},
				},
			]);
		});
	});

	suite("Ollama's native reads", () => {
		test('reads the loaded window and the digest when configured for Ollama', async () => {
			model.answer((request, response) => {
				const body =
					request.path === '/api/ps'
						? { models: [{ name: 'qwen3:14b', context_length: 16_384 }] }
						: { models: [{ name: 'qwen3:14b', digest: 'sha256:abc' }] };
				response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(body));
			});
			const provider = new OpenAiCompatibleProvider({ baseUrl: model.url, ollama: true });
			const signal = new AbortController().signal;

			assert.equal(await provider.contextWindow('qwen3:14b', signal), 16_384);
			assert.equal(await provider.modelDigest('qwen3:14b', signal), 'sha256:abc');
			assert.equal(await provider.contextWindow('not-loaded', signal), undefined);
		});

		test('never follows a redirect from a native endpoint', async () => {
			const elsewhere = await startModelServer();
			try {
				model.answer((request, response) => {
					response.writeHead(307, { location: `${elsewhere.url.replace(/\/v1$/, '')}${request.path}` }).end();
				});
				const provider = new OpenAiCompatibleProvider({ baseUrl: model.url, ollama: true });

				assert.equal(await provider.contextWindow('qwen3:14b', new AbortController().signal), undefined);
				assert.equal(elsewhere.requests.length, 0);
			} finally {
				await elsewhere.close();
			}
		});

		test('reads nothing natively unless configured for Ollama', async () => {
			const provider = new OpenAiCompatibleProvider({ baseUrl: model.url });
			const before = model.requests.length;
			const signal = new AbortController().signal;

			assert.equal(await provider.contextWindow('qwen3:14b', signal), undefined);
			assert.equal(await provider.modelDigest('qwen3:14b', signal), undefined);
			assert.equal(model.requests.length, before);
		});
	});
});
