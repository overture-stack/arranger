import type { ElicitResult } from '@modelcontextprotocol/client';

// The SDK types a host needs, so it can depend on this module alone.
export type {
	AuthProvider,
	CallToolResult,
	DiscoverResult,
	ElicitResult,
	GetPromptResult,
	Implementation,
	ListPromptsResult,
	ListResourcesResult,
	ListResourceTemplatesResult,
	ListToolsResult,
	Prompt,
	ReadResourceResult,
	Resource,
	ResourceTemplateType,
	ResponseCacheStore,
	ServerCapabilities,
	Tool,
} from '@modelcontextprotocol/client';

/** One question from the server, as passed to an {@link InputResolver}. */
export type InputQuestion = {
	/** `${callId}/${round}/${key}`, unique within a run. */
	questionId: string;
	/** The host's id for the tool call, prompt or resource read. */
	callId: string;
	/** The round this question belongs to, from 1. */
	round: number;
	/** The question's key in the server's `inputRequests`. */
	key: string;
	/** Untrusted text from the server: render it as text, never HTML. */
	message: string;
	/** The JSON Schema of the form the server asks for. */
	requestedSchema: unknown;
	/** Aborts when the call is cancelled, or when another question in the round fails. */
	signal: AbortSignal;
};

/**
 * Answers one server question, usually by asking a person.
 *
 * @param question - The question, with the call it belongs to.
 * @returns The answer to send to the server; `decline` and `cancel` are answers too.
 */
export type InputResolver = (question: InputQuestion) => Promise<ElicitResult>;

/** One `input_required` round, reported before any of its questions is asked. */
export type RoundInfo = {
	/** The host's id for the call. */
	callId: string;
	/** From 1. */
	round: number;
	/** Opaque to the client, and echoed byte for byte on the retry. */
	requestState?: string;
	/** The round's question keys; empty for a round without questions. */
	keys: string[];
};

/** Options for one tool call, prompt or resource read. */
export type CallOptions = {
	/** Cancels the call, including while a question waits. */
	signal?: AbortSignal;
	/** Observes each round. A throw ends the call as `input_failed`. */
	onRound?: (round: RoundInfo) => void;
};
