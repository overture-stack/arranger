// Host-core's own client for OpenAI-compatible Chat Completions (MCP Host Plan §2.2, LLM Provider Interface; Model
// Provider Analysis). It reads no environment variables and never retries: a failure is reported once, as data.
import { createParser } from 'eventsource-parser';

import { isRecord } from '../json.js';
import { type ConversationItem } from '../messages.js';
import {
	type FinalResponse,
	type LlmProvider,
	type ModelError,
	type ProviderMalformedCall,
	type ProviderRequest,
	type ProviderStreamItem,
	type ProviderToolCall,
	type StopReason,
	type TokenUsage,
} from '../provider.js';
import { assertTimeout } from '../timeouts.js';

/** The most of an error response's body kept in a `model_error`. */
export const MAX_ERROR_BODY_CHARS = 4_096;

/** The largest single stream event read, so a server that never ends a line cannot exhaust memory. */
const MAX_EVENT_BYTES = 8 * 1024 * 1024;

/** Configuration for {@link OpenAiCompatibleProvider}. */
export type OpenAiCompatibleOptions = {
	/** The server's OpenAI-compatible base URL, such as `http://localhost:11434/v1`. Required: there is no default. */
	baseUrl: string;
	/**
	 * Sent as a bearer token. A function is called before every request, so a short-lived token can be refreshed
	 * between requests; a 401 is reported, never retried.
	 */
	apiKey?: string | ((signal: AbortSignal) => Promise<string | undefined>);
	/** Ends a request that takes longer, as a `timeout` error. No limit when unset. */
	requestTimeoutMs?: number;
	/**
	 * Sends each assistant turn's reasoning back to the model. Off by default: in Phase 0 it cost a median of 81 to
	 * 538 prompt tokens per earlier turn with no consistent effect.
	 */
	sendReasoning?: boolean;
	/** Streams the reply. On by default; `eval` turns it off. */
	stream?: boolean;
	/**
	 * The server is Ollama: read the loaded context window (`/api/ps`) and the model's digest (`/api/tags`) from its
	 * native API. Every model call still goes through the Chat Completions endpoint.
	 */
	ollama?: boolean;
};

type WireToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } };

type WireMessage =
	| { role: 'system' | 'user'; content: string }
	| { role: 'assistant'; content: string | null; reasoning?: string; tool_calls?: WireToolCall[] }
	| { role: 'tool'; tool_call_id: string; content: string };

/** A call's arguments as the server will accept them: a JSON object, with unparseable text wrapped in one. */
const wireArguments = (raw: string): string => {
	try {
		if (isRecord(JSON.parse(raw))) {
			return raw;
		}
	} catch {
		// Wrapped below.
	}
	return JSON.stringify({ unparsed: raw });
};

/**
 * Maps the conversation to Chat Completions messages.
 *
 * @remarks
 * A turn's calls join the assistant message before them, or a new one when there is none; each tool message is
 * keyed by the model's own call id where it gave one.
 */
export const toWireMessages = (
	systemPrompt: string,
	items: readonly ConversationItem[],
	sendReasoning: boolean,
): WireMessage[] => {
	const wireIds = new Map<string, string>();
	const messages: WireMessage[] = systemPrompt ? [{ role: 'system', content: systemPrompt }] : [];

	for (const item of items) {
		switch (item.type) {
			case 'message':
				if (item.role === 'user') {
					messages.push({ role: 'user', content: item.text });
				} else {
					messages.push({
						role: 'assistant',
						content: item.text,
						...(sendReasoning && item.reasoning !== undefined && { reasoning: item.reasoning }),
					});
				}
				break;
			case 'function_call': {
				const id = item.modelCallId ?? item.callId;
				wireIds.set(item.callId, id);
				const call: WireToolCall = {
					id,
					type: 'function',
					function: { name: item.name || 'unparsed_call', arguments: wireArguments(item.arguments) },
				};
				const last = messages.at(-1);
				if (last?.role === 'assistant') {
					last.tool_calls = [...(last.tool_calls ?? []), call];
				} else {
					messages.push({ role: 'assistant', content: null, tool_calls: [call] });
				}
				break;
			}
			case 'function_call_output':
				messages.push({
					role: 'tool',
					tool_call_id: wireIds.get(item.callId) ?? item.callId,
					content: item.output,
				});
				break;
		}
	}
	return messages;
};

/**
 * The request body.
 *
 * @remarks
 * `max_tokens` rather than `max_completion_tokens`, which Ollama ignores. `extra` goes last, so an engine field
 * can override any other.
 */
export const toWireRequest = (
	request: ProviderRequest,
	options: { stream: boolean; sendReasoning: boolean },
): Record<string, unknown> => ({
	model: request.model,
	messages: toWireMessages(request.systemPrompt, request.messages, options.sendReasoning),
	...(request.tools.length > 0 && {
		tools: request.tools.map(({ name, description, parameters }) => ({
			type: 'function',
			function: { name, ...(description !== undefined && { description }), parameters },
		})),
	}),
	temperature: request.temperature,
	top_p: request.topP,
	...(request.seed !== undefined && { seed: request.seed }),
	max_tokens: request.maxOutputTokens,
	...(request.responseFormat !== undefined && {
		response_format: {
			type: 'json_schema',
			json_schema: { name: 'response', schema: request.responseFormat, strict: true },
		},
	}),
	stream: options.stream,
	...(options.stream && { stream_options: { include_usage: true } }),
	...request.extra,
});

const stopReasonOf = (finishReason: string): StopReason => {
	switch (finishReason) {
		case 'stop':
		case 'length':
		case 'tool_calls':
		case 'content_filter':
			return finishReason;
		case 'function_call':
			return 'tool_calls';
		default:
			return 'other';
	}
};

const usageOf = (usage: unknown): TokenUsage | undefined => {
	if (!isRecord(usage) || typeof usage.prompt_tokens !== 'number' || typeof usage.completion_tokens !== 'number') {
		return undefined;
	}
	const details = isRecord(usage.completion_tokens_details) ? usage.completion_tokens_details : {};
	return {
		inputTokens: usage.prompt_tokens,
		outputTokens: usage.completion_tokens,
		...(typeof usage.total_tokens === 'number' && { totalTokens: usage.total_tokens }),
		...(typeof details.reasoning_tokens === 'number' && { reasoningTokens: details.reasoning_tokens }),
	};
};

/** Ollama's `/v1` names reasoning `reasoning`; other servers, `reasoning_content`. */
const reasoningOf = (message: Record<string, unknown>): string | undefined => {
	const reasoning = message.reasoning ?? message.reasoning_content;
	return typeof reasoning === 'string' && reasoning.length > 0 ? reasoning : undefined;
};

/**
 * Classifies one call as the model sent it.
 *
 * @remarks
 * Empty arguments are read as `{}`, which some servers send for a tool without parameters. A call with no name,
 * or arguments that are not a JSON object, is malformed, and keeps its raw text.
 */
const classifyCall = (id: string | undefined, name: string, args: string): ProviderToolCall | ProviderMalformedCall => {
	const raw = args.trim() === '' ? '{}' : args;
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		parsed = undefined;
	}
	if (!name || !isRecord(parsed)) {
		return {
			kind: 'malformed',
			...(id && { id }),
			...(name && { name }),
			raw: args,
		};
	}
	return { kind: 'call', ...(id && { id }), name, arguments: raw };
};

/** One tool call as it is gathered. */
type GatheredCall = { id?: string; name: string; arguments: string };

/** The pieces of a reply, gathered from the stream or read whole. */
type Gathered = {
	text: string;
	reasoning: string;
	/** By the index the server gave each call, which need not start at 0 or arrive in order. */
	calls: Map<number, GatheredCall>;
	finishReason?: string;
	usage?: TokenUsage;
	modelId?: string;
	refusal?: string;
};

const finalResponse = (gathered: Gathered, durationMs: number): FinalResponse => ({
	text: gathered.text,
	...(gathered.reasoning && { reasoning: gathered.reasoning }),
	toolCalls: [...gathered.calls.entries()]
		.sort(([a], [b]) => a - b)
		.map(([, { id, name, arguments: args }]) => classifyCall(id, name, args)),
	...(gathered.usage && { usage: gathered.usage }),
	stopReason: stopReasonOf(gathered.finishReason ?? ''),
	...(gathered.modelId && { modelId: gathered.modelId }),
	durationMs,
});

const emptyGathered = (): Gathered => ({ text: '', reasoning: '', calls: new Map() });

/**
 * Folds one streamed chunk into what has been gathered.
 *
 * @remarks
 * A whole reply folds the same way, as a single chunk whose delta is its message.
 *
 * @returns Any visible text the chunk added.
 */
const foldChunk = (gathered: Gathered, chunk: Record<string, unknown>): string => {
	if (typeof chunk.model === 'string') {
		gathered.modelId = chunk.model;
	}
	gathered.usage = usageOf(chunk.usage) ?? gathered.usage;
	const choice = Array.isArray(chunk.choices) && isRecord(chunk.choices[0]) ? chunk.choices[0] : undefined;
	if (!choice) {
		return '';
	}
	if (typeof choice.finish_reason === 'string') {
		gathered.finishReason = choice.finish_reason;
	}
	const delta = isRecord(choice.delta) ? choice.delta : {};
	gathered.reasoning += reasoningOf(delta) ?? '';
	if (typeof delta.refusal === 'string') {
		gathered.refusal = (gathered.refusal ?? '') + delta.refusal;
	}
	for (const fragment of Array.isArray(delta.tool_calls) ? delta.tool_calls : []) {
		if (!isRecord(fragment)) {
			continue;
		}
		// A fragment without an index, as in a whole reply, starts a call of its own after every other.
		const index = typeof fragment.index === 'number' ? fragment.index : Math.max(-1, ...gathered.calls.keys()) + 1;
		const call = gathered.calls.get(index) ?? { name: '', arguments: '' };
		gathered.calls.set(index, call);
		if (typeof fragment.id === 'string' && fragment.id) {
			call.id = fragment.id;
		}
		const fn = isRecord(fragment.function) ? fragment.function : {};
		if (typeof fn.name === 'string') {
			call.name += fn.name;
		}
		if (typeof fn.arguments === 'string') {
			call.arguments += fn.arguments;
		}
	}
	const text = typeof delta.content === 'string' ? delta.content : '';
	gathered.text += text;
	return text;
};

/** Reads a whole, non-streamed reply, through the same fold as a stream. */
const gatherWhole = (body: unknown): Gathered => {
	const gathered = emptyGathered();
	if (!isRecord(body)) {
		return gathered;
	}
	const choice = Array.isArray(body.choices) && isRecord(body.choices[0]) ? body.choices[0] : {};
	foldChunk(gathered, { ...body, choices: [{ finish_reason: choice.finish_reason, delta: choice.message }] });
	return gathered;
};

/** The error to report once the request is over, from whichever signal ended it. */
const endedBy = (caller: AbortSignal, timedOut: boolean, error: unknown): ModelError => {
	if (caller.aborted) {
		return { kind: 'aborted', message: 'The request was aborted' };
	}
	if (timedOut) {
		return { kind: 'timeout', message: 'The model server did not answer in time' };
	}
	return { kind: 'network', message: error instanceof Error ? error.message : String(error) };
};

/** An OpenAI-compatible Chat Completions server, such as Ollama, vLLM, LM Studio or hosted OpenAI. */
export class OpenAiCompatibleProvider implements LlmProvider {
	readonly url: string;
	readonly sendsReasoning: boolean;
	readonly #options: OpenAiCompatibleOptions;

	/**
	 * @param options - The server's base URL, its key, and how to call it.
	 * @throws `TypeError` when the base URL is missing, or `requestTimeoutMs` is not a usable timeout.
	 */
	constructor(options: OpenAiCompatibleOptions) {
		if (!options.baseUrl) {
			throw new TypeError('The provider needs a base URL');
		}
		if (options.requestTimeoutMs !== undefined) {
			assertTimeout('requestTimeoutMs', options.requestTimeoutMs);
		}
		this.#options = options;
		this.url = options.baseUrl.replace(/\/+$/, '');
		this.sendsReasoning = options.sendReasoning === true;
	}

	async #headers(signal: AbortSignal): Promise<Record<string, string>> {
		const { apiKey } = this.#options;
		const key = typeof apiKey === 'function' ? await apiKey(signal) : apiKey;
		return {
			'content-type': 'application/json',
			accept: 'application/json, text/event-stream',
			...(key && { authorization: `Bearer ${key}` }),
		};
	}

	/** One request's signal: the caller's, joined with the provider's own timeout. */
	#requestSignal(caller: AbortSignal): { signal: AbortSignal; state: { timedOut: boolean }; done: () => void } {
		const timeout = new AbortController();
		const state = { timedOut: false };
		const { requestTimeoutMs } = this.#options;
		const timer =
			requestTimeoutMs === undefined
				? undefined
				: setTimeout(() => {
						state.timedOut = true;
						timeout.abort(new Error('timeout'));
					}, requestTimeoutMs);
		return {
			signal: AbortSignal.any([caller, timeout.signal]),
			state,
			done: () => clearTimeout(timer),
		};
	}

	async *generate(request: ProviderRequest, signal: AbortSignal): AsyncIterable<ProviderStreamItem> {
		const stream = this.#options.stream ?? true;
		const started = Date.now();
		const { signal: requestSignal, state, done } = this.#requestSignal(signal);
		try {
			let headers: Record<string, string>;
			try {
				headers = await this.#headers(requestSignal);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				yield {
					type: 'error',
					error: { kind: 'unknown', message: `The API key could not be read: ${message}` },
				};
				return;
			}
			let response: Response;
			try {
				response = await fetch(`${this.url}/chat/completions`, {
					method: 'POST',
					headers,
					body: JSON.stringify(toWireRequest(request, { stream, sendReasoning: this.sendsReasoning })),
					signal: requestSignal,
				});
			} catch (error) {
				yield { type: 'error', error: endedBy(signal, state.timedOut, error) };
				return;
			}

			if (!response.ok) {
				let body = '';
				try {
					body = (await response.text()).slice(0, MAX_ERROR_BODY_CHARS);
				} catch {
					// The status is enough to report.
				}
				yield {
					type: 'error',
					error: {
						kind: 'http',
						message: `The model server answered ${response.status} ${response.statusText}`.trim(),
						status: response.status,
						...(body && { body }),
					},
				};
				return;
			}

			let gathered: Gathered;
			try {
				if (stream) {
					gathered = emptyGathered();
					const deltas: string[] = [];
					let invalid: string | undefined;
					const parser = createParser({
						maxBufferSize: MAX_EVENT_BYTES,
						onEvent: ({ data }) => {
							if (data === '[DONE]' || invalid !== undefined) {
								return;
							}
							let chunk: unknown;
							try {
								chunk = JSON.parse(data);
							} catch {
								invalid = data.slice(0, MAX_ERROR_BODY_CHARS);
								return;
							}
							if (isRecord(chunk) && isRecord(chunk.error)) {
								invalid = JSON.stringify(chunk.error).slice(0, MAX_ERROR_BODY_CHARS);
								return;
							}
							if (isRecord(chunk)) {
								const text = foldChunk(gathered, chunk);
								if (text) {
									deltas.push(text);
								}
							}
						},
						onError: (error) => {
							invalid ??= error.message;
						},
					});
					const decoder = new TextDecoder();
					for await (const bytes of response.body ?? []) {
						parser.feed(decoder.decode(bytes as Uint8Array, { stream: true }));
						yield* deltas.splice(0).map((text): ProviderStreamItem => ({ type: 'delta', text }));
						if (invalid !== undefined) {
							break;
						}
					}
					parser.feed(decoder.decode());
					yield* deltas.splice(0).map((text): ProviderStreamItem => ({ type: 'delta', text }));
					if (invalid !== undefined) {
						yield {
							type: 'error',
							error: {
								kind: 'unknown',
								message: 'The model server sent an error or an unreadable event',
								body: invalid,
							},
						};
						return;
					}
				} else {
					gathered = gatherWhole(await response.json());
				}
			} catch (error) {
				yield { type: 'error', error: endedBy(signal, state.timedOut, error) };
				return;
			}

			if (gathered.refusal) {
				yield { type: 'error', error: { kind: 'refusal', message: gathered.refusal } };
				return;
			}
			if (gathered.finishReason === undefined) {
				// Ollama's `/v1` drops an error raised mid-stream and just stops.
				yield {
					type: 'error',
					error: { kind: 'stream_ended', message: 'The reply ended without a finish reason' },
				};
				return;
			}
			yield { type: 'response', response: finalResponse(gathered, Date.now() - started) };
		} finally {
			done();
		}
	}

	/** Reads one of Ollama's native endpoints, at the root the `/v1` base URL sits under. */
	async #native(path: '/api/ps' | '/api/tags', signal: AbortSignal): Promise<unknown> {
		const root = this.url.replace(/\/v1$/, '');
		const response = await fetch(`${root}${path}`, { headers: await this.#headers(signal), signal });
		return response.ok ? response.json() : undefined;
	}

	/** Finds a model in a native listing, whose names carry a `:latest` tag when none was given. */
	static #find(listing: unknown, model: string): Record<string, unknown> | undefined {
		const models = isRecord(listing) && Array.isArray(listing.models) ? listing.models : [];
		return models.find(
			(entry): entry is Record<string, unknown> =>
				isRecord(entry) && (entry.name === model || entry.name === `${model}:latest` || entry.model === model),
		);
	}

	/**
	 * The model's digest, from Ollama's `/api/tags`.
	 *
	 * @returns `undefined` unless the provider is configured for Ollama and the server lists the model.
	 */
	async modelDigest(model: string, signal: AbortSignal): Promise<string | undefined> {
		if (!this.#options.ollama) {
			return undefined;
		}
		const digest = OpenAiCompatibleProvider.#find(await this.#native('/api/tags', signal), model)?.digest;
		return typeof digest === 'string' ? digest : undefined;
	}

	/**
	 * The context window the model is loaded with, from Ollama's `/api/ps`.
	 *
	 * @returns `undefined` unless the provider is configured for Ollama and the model is loaded.
	 */
	async contextWindow(model: string, signal: AbortSignal): Promise<number | undefined> {
		if (!this.#options.ollama) {
			return undefined;
		}
		const length = OpenAiCompatibleProvider.#find(await this.#native('/api/ps', signal), model)?.context_length;
		return typeof length === 'number' ? length : undefined;
	}
}
