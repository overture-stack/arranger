// The seam between host-core and a model server (MCP Host Plan §2.2, LLM Provider Interface): nothing here assumes a
// wire format or how a provider authenticates.
import { type ConversationItem } from './messages.js';
import { type ToolDefinition } from './registry.js';

/** The model and how to sample it. Every field is recorded in `model_request`. */
export type ModelSettings = {
	model: string;
	/** Always sent: Ollama's `/v1` sets an omitted one to 1.0, overriding the model's default. */
	temperature: number;
	/** Always sent, for the same reason. */
	topP: number;
	seed?: number;
	/** The reply cap. Reasoning counts against it, and it shares the context window. */
	maxOutputTokens: number;
	/** A JSON Schema the output must match. */
	responseFormat?: unknown;
	/** Engine-specific fields, such as `top_k` or `reasoning_effort`, passed through unchanged. */
	extra?: Record<string, unknown>;
};

/** One request to the model. */
export type ProviderRequest = ModelSettings & {
	systemPrompt: string;
	messages: ConversationItem[];
	tools: ToolDefinition[];
};

/** A well-formed tool call. */
export type ProviderToolCall = {
	kind: 'call';
	/** The model's id for the call, if it gave one. */
	id?: string;
	name: string;
	/** The arguments as the model sent them, unparsed. */
	arguments: string;
};

/** A tool call the provider could not parse, with what came back. */
export type ProviderMalformedCall = {
	kind: 'malformed';
	id?: string;
	name?: string;
	/** The raw output, kept so `eval` can count parse failures. */
	raw: string;
};

/** Token counts exactly as the serving stack reported them. */
export type TokenUsage = {
	inputTokens: number;
	outputTokens: number;
	totalTokens?: number;
	reasoningTokens?: number;
};

/** Why the model stopped. `length` means it reached the output limit. */
export type StopReason = 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'other';

/** What one `generate()` call produced. */
export type FinalResponse = {
	text: string;
	reasoning?: string;
	/** Well-formed and malformed calls, in the order the model made them. */
	toolCalls: (ProviderToolCall | ProviderMalformedCall)[];
	/** Absent when the serving stack reported none. */
	usage?: TokenUsage;
	stopReason: StopReason;
	/** The model id the server reported. */
	modelId?: string;
	durationMs: number;
	/** Opaque items to keep on the assistant turn, such as encrypted reasoning. */
	providerItems?: unknown[];
};

/**
 * Why the model server gave no usable reply.
 *
 * @remarks
 * - `http`: an HTTP error status, with its body.
 * - `timeout`: the provider's own timeout ran out.
 * - `refusal`: the server refused the request.
 * - `stream_ended`: the stream ended without a finish reason, or without a response.
 * - `network`: the request could not be sent or read.
 * - `aborted`: the run's signal aborted the request.
 * - `truncated`: the server counted fewer prompt tokens than the previous turn for a longer request, so it dropped
 *   messages on its own (host-core's backstop, not the provider's).
 * - `unknown`: anything else, including a provider that threw.
 */
export type ModelErrorKind =
	| 'http'
	| 'timeout'
	| 'refusal'
	| 'stream_ended'
	| 'network'
	| 'aborted'
	| 'truncated'
	| 'unknown';

/** A model server error, as plain data. */
export type ModelError = { kind: ModelErrorKind; message: string; status?: number; body?: string };

/** What a provider's stream yields: text as it arrives, then exactly one response or error. */
export type ProviderStreamItem =
	| { type: 'delta'; text: string }
	| { type: 'response'; response: FinalResponse }
	| { type: 'error'; error: ModelError };

/**
 * A model server, behind one method.
 *
 * @remarks
 * A provider never retries, and reports errors as a stream item rather than by throwing. How it authenticates is
 * its own constructor's concern, such as a per-request token callback.
 */
export type LlmProvider = {
	/** The server's base URL, recorded in `run_started`. */
	readonly url: string;

	/**
	 * Whether the provider sends assistant turns' reasoning back to the model, so the context-window estimate counts
	 * it.
	 *
	 * @defaultValue false
	 */
	readonly sendsReasoning?: boolean;

	/**
	 * Sends one request.
	 *
	 * @param request - The model settings, system prompt, messages and tools.
	 * @param signal - Aborts the request.
	 * @returns Deltas, then one `response` or `error` item.
	 */
	generate(request: ProviderRequest, signal: AbortSignal): AsyncIterable<ProviderStreamItem>;

	/**
	 * The model's digest, where the server reports one, for `run_started`.
	 *
	 * @returns `undefined` when the server does not say.
	 */
	modelDigest?(model: string, signal: AbortSignal): Promise<string | undefined>;

	/**
	 * The context window the server has the model loaded with, where it reports one, since a server such as Ollama's
	 * `/v1` cannot set it per request and truncates silently past it.
	 *
	 * @returns `undefined` when the server does not say, including when the model is not loaded yet.
	 */
	contextWindow?(model: string, signal: AbortSignal): Promise<number | undefined>;

	/**
	 * Lowers the reasoning effort for the retry after a reply cut off at the output limit, where the provider
	 * supports it.
	 *
	 * @returns The request to send instead.
	 */
	reduceReasoning?(request: ProviderRequest): ProviderRequest;
};
