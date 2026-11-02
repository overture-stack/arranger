// Every event is plain data, so it crosses IPC unchanged and saves to a file as it is.
import { type ElicitResult, type McpClientOptions, type ServerCapabilities } from '@overture-stack/arranger-mcp-client';

import { type ApprovalCall, type PendingQuestion } from './answers.js';
import { type APPROVAL_DECISIONS, type DONE_REASONS, type EVENT_TYPES } from './constants.js';
import { type ContextWindowSettings, type ShortenedResult } from './context.js';
import {
	type FinalResponse,
	type ModelError,
	type ModelSettings,
	type ProviderMalformedCall,
	type ProviderRequest,
} from './provider.js';
import { type LeftOutTool } from './registry.js';
import { type RetryKind, type RetrySettings } from './reply.js';
import { type CarryRecord } from './state.js';
import { type ToolCallOutcome } from './toolMessages.js';
import { type ObjectValues } from './utils.js';

/** Limits that end a run. */
export type RunLimits = { turns: number; toolCalls: number; wallClockMs: number };

/** Why a run ended: one of {@link DONE_REASONS}. */
export type DoneReason = ObjectValues<typeof DONE_REASONS>;

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
			type: typeof EVENT_TYPES.RUN_STARTED;
			model: ModelSettings;
			providerUrl: string;
			modelDigest?: string;
			limits: RunLimits;
			retries: RetrySettings;
			contextWindow: ContextWindowSettings;
			/** The window the model server reported, when it reports one; the run uses the smaller of the two. */
			reportedContextWindow?: number;
			toolResultMaxChars?: number;
			clientInfo: McpClientOptions['clientInfo'];
			servers: RunServer[];
	  }
	| {
			type: typeof EVENT_TYPES.TOOLS_CHANGED;
			servers: { key: string; hash: string }[];
			leftOut: LeftOutTool[];
			/** Servers whose surface could not be re-read; their previous tools are kept. */
			errors: { key: string; message: string }[];
	  }
	| {
			type: typeof EVENT_TYPES.MODEL_REQUEST;
			turn: number;
			/** The request, except its messages. */
			request: Omit<ProviderRequest, 'messages'>;
			messageCount: number;
			/** Set on a retry, naming what it retries. */
			retryOf?: RetryKind;
	  }
	| {
			type: typeof EVENT_TYPES.CONTENT_CARRIED;
			/** What the person carried, as the model is sent it after its label. */
			text: string;
			/** The server it came from, in the conversation it was carried out of. */
			from: CarryRecord['from'];
			/** This conversation's servers. */
			to: string[];
			/** When the person carried it, as ISO 8601. */
			carriedAt: string;
	  }
	| { type: typeof EVENT_TYPES.TOKEN; turn: number; text: string }
	| { type: typeof EVENT_TYPES.MODEL_RESPONSE; turn: number; response: FinalResponse }
	| { type: typeof EVENT_TYPES.MALFORMED_TOOL_CALL; turn: number; callId: string; call: ProviderMalformedCall }
	| {
			type: typeof EVENT_TYPES.EMPTY_REPLY;
			turn: number;
			outputTokens?: number;
			stopReason: FinalResponse['stopReason'];
			retrying: boolean;
	  }
	| {
			type: typeof EVENT_TYPES.CONTEXT_SHORTENED;
			turn: number;
			shortened: ShortenedResult[];
			estimateBefore: number;
			estimateAfter: number;
			windowTokens: number;
	  }
	| { type: typeof EVENT_TYPES.OUTPUT_LIMIT; turn: number; outputTokens?: number; text: string; retrying: boolean }
	| { type: typeof EVENT_TYPES.MODEL_ERROR; turn: number; error: ModelError }
	| (ApprovalCall & { type: typeof EVENT_TYPES.APPROVAL_REQUIRED; id: string })
	| {
			type: typeof EVENT_TYPES.APPROVAL_ANSWERED;
			id: string;
			callId: string;
			decision: typeof APPROVAL_DECISIONS.ALLOW | typeof APPROVAL_DECISIONS.DENY;
			timedOut: boolean;
			waitedMs: number;
	  }
	| {
			type: typeof EVENT_TYPES.TOOL_CALL;
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
			type: typeof EVENT_TYPES.INPUT_REQUIRED;
			questionId: string;
			callId: string;
			server: string;
			round: number;
			key: string;
			/** Untrusted text from the server: render it as text, never HTML. */
			message: string;
			requestedSchema: unknown;
	  }
	| {
			type: typeof EVENT_TYPES.INPUT_ANSWERED;
			questionId: string;
			answer: ElicitResult;
			waitedMs: number;
			timedOut: boolean;
	  }
	| {
			/**
			 * An open approval or confirmation was closed unanswered, because its run was cancelled or reached its time
			 * limit. A question that reaches its own timeout is answered instead, with `timedOut` set.
			 */
			type: typeof EVENT_TYPES.QUESTION_WITHDRAWN;
			id: string;
			kind: PendingQuestion['kind'];
			callId: string;
	  }
	| { type: typeof EVENT_TYPES.INPUT_STATE_REJECTED; callId: string; server: string; waitedMs: number }
	| {
			type: typeof EVENT_TYPES.TOOL_RESULT;
			callId: string;
			server?: string;
			tool?: string;
			/** The full outcome, including the whole result, even when the tool message was cut or later shortened. */
			outcome: ToolCallOutcome;
			isError: boolean;
	  }
	| { type: typeof EVENT_TYPES.DONE; reason: DoneReason; detail?: string; totals: RunTotals };

/** One event, as the consumer's listener receives it. */
export type HostEvent = EventBody & EventBase;

/** The `done` event, which `run()` also resolves with. */
export type RunSummary = Extract<HostEvent, { type: typeof EVENT_TYPES.DONE }>;
