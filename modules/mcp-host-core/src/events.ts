// Every event is plain data, so it crosses IPC unchanged and saves to a file as it is (MCP Host Plan §1, rule 6).
import { type ElicitResult, type ServerCapabilities } from '@overture-stack/arranger-mcp-client';

import { type ContextWindowSettings, type ShortenedResult } from './context.js';
import {
	type FinalResponse,
	type ModelError,
	type ModelSettings,
	type ProviderMalformedCall,
	type ProviderRequest,
} from './provider.js';
import { type LeftOutTool } from './registry.js';
import { type ToolCallOutcome } from './toolMessages.js';

/** Limits that end a run. */
export type RunLimits = { turns: number; toolCalls: number; wallClockMs: number };

/**
 * Why a run ended.
 *
 * @remarks
 * - `answered`: the model answered in text.
 * - `turn_limit`, `tool_call_limit`, `time_limit`: a limit was reached.
 * - `cancelled`: the consumer's signal aborted the run.
 * - `model_error`: the model server failed; the conversation is still valid.
 * - `context_window`: the request could not fit, or the server truncated it anyway.
 * - `output_limit`: the reply was cut off at the output limit, and was not retried or was cut off again.
 * - `empty_reply`: the model returned nothing, a parse failure, and was not retried or was empty again.
 * - `prompt_failed`: the prompt the run started from could not be fetched, or its server is not trusted.
 * - `surface_error`: a server's surface could not be re-read at the start of the run.
 * - `tool_collision`: two tools reduced to one name at the start of the run.
 */
export type DoneReason =
	| 'answered'
	| 'turn_limit'
	| 'tool_call_limit'
	| 'time_limit'
	| 'cancelled'
	| 'model_error'
	| 'context_window'
	| 'output_limit'
	| 'empty_reply'
	| 'prompt_failed'
	| 'surface_error'
	| 'tool_collision';

/** A run's totals, in `done`. */
export type RunTotals = {
	turns: number;
	toolCalls: number;
	/** Summed over turns that reported usage. */
	inputTokens: number;
	outputTokens: number;
	durationMs: number;
};

/** A server as `run_started` records it. */
export type RunServer = {
	key: string;
	trusted: boolean;
	/** Whether the person attests the server holds only open-access data, so its data may cross to other servers. */
	containsOnlyOpenData: boolean;
	/** The server's name and version, when its `server/discover` gave them. */
	server?: { name: string; version: string };
	hash: string;
	capabilities: ServerCapabilities;
};

/** What the event union adds to every event. */
export type EventBase = {
	runId: string;
	/** From 0 within a run. */
	seq: number;
	/** ISO 8601. */
	at: string;
};

/** The events of a run, before {@link EventBase} is added. */
export type EventBody =
	| {
			type: 'run_started';
			model: ModelSettings;
			providerUrl: string;
			modelDigest?: string;
			limits: RunLimits;
			retries: { emptyReply: boolean; outputLimit: boolean };
			contextWindow: ContextWindowSettings;
			/** The window the model server reported, when it reports one; the run uses the smaller of the two. */
			reportedContextWindow?: number;
			toolResultMaxChars?: number;
			clientInfo: { name: string; version: string };
			servers: RunServer[];
	  }
	| {
			type: 'tools_changed';
			servers: { key: string; hash: string }[];
			leftOut: LeftOutTool[];
			/** Servers whose surface could not be re-read; their previous tools are kept. */
			errors: { key: string; message: string }[];
	  }
	| {
			type: 'model_request';
			turn: number;
			/** The request, except its messages. */
			request: Omit<ProviderRequest, 'messages'>;
			messageCount: number;
			/** Set on a retry, naming what it retries. */
			retryOf?: 'empty_reply' | 'output_limit';
	  }
	| {
			type: 'content_carried';
			/** What the person carried, as the model is sent it after its label. */
			text: string;
			/** The server it came from, in the conversation it was carried out of. */
			from: { server: string; name?: string };
			/** This conversation's servers. */
			to: string[];
			/** When the person carried it, as ISO 8601. */
			carriedAt: string;
	  }
	| { type: 'token'; turn: number; text: string }
	| { type: 'model_response'; turn: number; response: FinalResponse }
	| { type: 'malformed_tool_call'; turn: number; callId: string; call: ProviderMalformedCall }
	| {
			type: 'empty_reply';
			turn: number;
			outputTokens?: number;
			stopReason: FinalResponse['stopReason'];
			retrying: boolean;
	  }
	| {
			type: 'context_shortened';
			turn: number;
			shortened: ShortenedResult[];
			estimateBefore: number;
			estimateAfter: number;
			windowTokens: number;
	  }
	| { type: 'output_limit'; turn: number; outputTokens?: number; text: string; retrying: boolean }
	| { type: 'model_error'; turn: number; error: ModelError }
	| { type: 'approval_required'; id: string; callId: string; server: string; tool: string; arguments: unknown }
	| {
			type: 'approval_answered';
			id: string;
			callId: string;
			decision: 'allow' | 'deny';
			timedOut: boolean;
			waitedMs: number;
	  }
	| {
			type: 'tool_call';
			callId: string;
			modelCallId?: string;
			/** The model-facing name. */
			name: string;
			server: string;
			tool: string;
			/** The arguments as the model sent them; providers may re-encode them, such as with sorted keys. */
			arguments: string;
	  }
	| {
			type: 'input_required';
			questionId: string;
			callId: string;
			server: string;
			round: number;
			key: string;
			/** Untrusted text from the server: render it as text, never HTML. */
			message: string;
			requestedSchema: unknown;
	  }
	| { type: 'input_answered'; questionId: string; answer: ElicitResult; waitedMs: number; timedOut: boolean }
	| {
			/**
			 * An open approval or confirmation was closed unanswered, because its run was cancelled or reached its time
			 * limit. A question that reaches its own timeout is answered instead, with `timedOut` set.
			 */
			type: 'question_withdrawn';
			id: string;
			kind: 'approval' | 'confirmation';
			callId: string;
	  }
	| { type: 'input_state_rejected'; callId: string; server: string; waitedMs: number }
	| {
			type: 'tool_result';
			callId: string;
			server?: string;
			tool?: string;
			/** The full outcome, including the whole result, even when the tool message was cut or later shortened. */
			outcome: ToolCallOutcome;
			isError: boolean;
	  }
	| { type: 'done'; reason: DoneReason; detail?: string; totals: RunTotals };

/** One event, as the consumer's listener receives it. */
export type HostEvent = EventBody & EventBase;

/** The `done` event, which `run()` also resolves with. */
export type RunSummary = Extract<HostEvent, { type: 'done' }>;
