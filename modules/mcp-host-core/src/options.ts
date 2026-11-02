// What a consumer configures an `McpHost` with, and the checks `McpHost.create` runs on it before anything connects.
import { type McpClientOptions } from '@overture-stack/arranger-mcp-client';

import { type ApprovalCall } from './answers.js';
import { type APPROVAL_DECISIONS } from './constants.js';
import { type ContextWindowSettings } from './context.js';
import { type HostEvent, type RunLimits } from './events.js';
import { type LlmProvider, type ModelSettings } from './provider.js';
import { type RetrySettings } from './reply.js';
import { type CarryRecord } from './state.js';
import { assertTimeout, type ObjectValues } from './utils.js';

/** One MCP server in a conversation. */
export type ServerConfig = {
	/** The `<server>` in `mcp__<server>__<tool>`. Unique within the conversation. */
	key: string;
	/**
	 * Whether the operator trusts this server: only a trusted server's `instructions` enter the system prompt, and
	 * only its prompts can start a run.
	 *
	 * @defaultValue false
	 */
	trusted?: boolean;
	/**
	 * The person's attestation that the server holds only open-access data, which anyone may read: no registered and
	 * no controlled data. Restricted data never reaches another server's requests unless the person carries it there.
	 * Off unless set, so a server is restricted by default.
	 *
	 * @defaultValue false
	 */
	containsOnlyOpenData?: boolean;
	/** Passed to `McpClient.connect`; host-core supplies the rest. */
	connection: Omit<McpClientOptions, 'clientInfo' | 'inputResolver' | 'changeNotifications' | 'onError'>;
	/** Re-read this server's tools between turns when it reports a change. Off by default. */
	changeNotifications?: boolean;
};

/** A pre-call decision. `ask` puts the call in front of the consumer. */
export type ApprovalDecision = ObjectValues<typeof APPROVAL_DECISIONS>;

/**
 * What the approval policy sees.
 *
 * @remarks
 * An object, so inputs can be added without breaking a policy. The data-crossing rule needs none: host-core refuses
 * a crossing before the policy is asked.
 */
export type ApprovalRequest = { call: ApprovalCall };

/**
 * Decides each call that crosses no data before it runs. Required: no run starts without one. A throw counts as
 * `deny`.
 */
export type ApprovalPolicy = (request: ApprovalRequest) => ApprovalDecision | Promise<ApprovalDecision>;

/** Configuration for `McpHost.create`. */
export type McpHostOptions = {
	/** The conversation's servers, fixed for its life. */
	servers: ServerConfig[];
	provider: LlmProvider;
	model: ModelSettings;
	/** The consumer's system prompt; trusted servers' instructions follow it. */
	systemPrompt?: string;
	approvalPolicy: ApprovalPolicy;
	/**
	 * Whether the consumer answers server confirmations. `false` declares no `elicitation`, so servers ask nothing.
	 * A confirmation that times out is answered `cancel`.
	 */
	confirmations: false | { timeoutMs?: number };
	/** How long an `ask` approval waits; one that times out counts as denied. No limit when unset. */
	approvalTimeoutMs?: number;
	limits: RunLimits;
	/** One retry each, for an interactive consumer; an evaluation sets both off, so every failure counts. */
	retries: RetrySettings;
	contextWindow: ContextWindowSettings;
	/** A cap on each tool message's characters, with the cut noted. Events keep the full result. */
	toolResultMaxChars?: number;
	/** Receives every event. Anything it throws is ignored. */
	onEvent: (event: HostEvent) => void;
	/** Receives errors a server's client raises outside any call. Anything it throws is ignored. */
	onServerError?: (server: string, error: Error) => void;
	/** A saved state to continue from. */
	state?: unknown;
	/** This host's name and version, sent to each server. */
	clientInfo: McpClientOptions['clientInfo'];
};

/** What the person carried out of another conversation, through their own action. */
export type CarriedContent = CarryRecord & { text: string };

/**
 * How a run starts: a person's message, which a new conversation may lead with carried content, or a trusted
 * server's prompt.
 */
export type RunInput =
	| { message: string; carried?: CarriedContent }
	| { prompt: { server: string; name: string; arguments?: Record<string, string> } };

/**
 * Checks the options a host is created with.
 *
 * @remarks
 * Only what types cannot catch: a consumer calling from JavaScript, or building options at runtime, gets an error
 * here rather than a run that misbehaves later.
 *
 * @param options - The options given to `McpHost.create`.
 * @throws `TypeError` for a missing or repeated server key, a `containsOnlyOpenData` that is not a boolean, a
 * missing approval policy, a limit or window that is not positive, or a timeout a Node timer cannot hold.
 */
export const validateOptions = (options: McpHostOptions): void => {
	const keys = options.servers.map(({ key }) => key);
	if (keys.some((key) => key.length === 0) || new Set(keys).size !== keys.length) {
		throw new TypeError('Each server needs a key, unique within the conversation');
	}
	// Anything but a boolean is refused rather than read as truthy, so the flag fails closed.
	if (options.servers.some(({ containsOnlyOpenData }) => ![undefined, true, false].includes(containsOnlyOpenData))) {
		throw new TypeError("A server's containsOnlyOpenData must be true or false");
	}
	if (typeof options.approvalPolicy !== 'function') {
		throw new TypeError('An approval policy is required');
	}
	const { turns, toolCalls, wallClockMs } = options.limits;
	if (![turns, toolCalls, options.contextWindow.tokens].every((value) => value > 0)) {
		throw new TypeError('Limits and the context window must be positive');
	}
	assertTimeout('limits.wallClockMs', wallClockMs);
	if (options.approvalTimeoutMs !== undefined) {
		assertTimeout('approvalTimeoutMs', options.approvalTimeoutMs);
	}
	if (options.confirmations !== false && options.confirmations.timeoutMs !== undefined) {
		assertTimeout('confirmations.timeoutMs', options.confirmations.timeoutMs);
	}
};
