// The seam between host-core and a model server: nothing here assumes a wire format or how a provider authenticates.
import {
	type MODEL_ERROR_KINDS,
	type STOP_REASONS,
	type STREAM_ITEM_TYPES,
	type TOOL_CALL_KINDS,
} from './constants.js';
import { type ConversationItem } from './messages.js';
import { type ToolDefinition } from './registry.js';
import { type ObjectValues } from './utils.js';

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
	/**
	 * Engine-specific fields, such as `top_k` or `reasoning_effort`, passed through unchanged.
	 *
	 * @remarks
	 * A provider may refuse a field host-core sets or relies on, such as the model, messages, tools, seed or reply cap.
	 */
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
	kind: typeof TOOL_CALL_KINDS.CALL;
	/** The model's id for the call, if it gave one. */
	id?: string;
	name: string;
	/** The arguments as the model sent them, unparsed. */
	arguments: string;
};

/** A tool call the provider could not parse, with what came back. */
export type ProviderMalformedCall = {
	kind: typeof TOOL_CALL_KINDS.MALFORMED;
	id?: string;
	name?: string;
	/** The raw output, kept so a consumer can count parse failures. */
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
export type StopReason = ObjectValues<typeof STOP_REASONS>;

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

/** Why the model server gave no usable reply: one of {@link MODEL_ERROR_KINDS}. */
export type ModelErrorKind = ObjectValues<typeof MODEL_ERROR_KINDS>;

/** A model server error, as plain data. */
export type ModelError = { kind: ModelErrorKind; message: string; status?: number; body?: string };

/** What a provider's stream yields: text as it arrives, then exactly one response or error. */
export type ProviderStreamItem =
	| { type: typeof STREAM_ITEM_TYPES.DELTA; text: string }
	| { type: typeof STREAM_ITEM_TYPES.RESPONSE; response: FinalResponse }
	| { type: typeof STREAM_ITEM_TYPES.ERROR; error: ModelError };

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
	 * Called when a host is created, so settings this provider would refuse on every request fail before anything
	 * connects.
	 *
	 * @throws `TypeError` naming each setting it refuses, and what to use instead.
	 */
	assertSettings?(settings: ModelSettings): void;

	/**
	 * Lowers the reasoning effort for the retry after a reply cut off at the output limit, where the provider
	 * supports it.
	 *
	 * @returns The request to send instead.
	 */
	reduceReasoning?(request: ProviderRequest): ProviderRequest;
};
