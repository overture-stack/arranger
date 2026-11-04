// What a run does with each model reply: run its tool calls, keep its answer, or retry or end after a reply cut off
// at the output limit or an empty one.
import { REPLY_DECISIONS, type RETRY_KINDS, STOP_REASONS } from './constants.js';
import { type FinalResponse } from './provider.js';
import { type ObjectValues } from './utils.js';

/** Why a request was sent again. */
export type RetryKind = ObjectValues<typeof RETRY_KINDS>;

/** Which retries a consumer allows: one each, after an empty reply and after a reply cut off with no text. */
export type RetrySettings = { emptyReply: boolean; outputLimit: boolean };

/** What to do with a reply. */
export type ReplyDecision =
	/** Run its tool calls, then ask the model again. */
	| { kind: typeof REPLY_DECISIONS.TOOL_CALLS }
	/** Keep its text as the answer, and end the run. */
	| { kind: typeof REPLY_DECISIONS.ANSWERED }
	/** It reached the output limit: keep any visible text, marked as cut off, and retry or end. */
	| { kind: typeof REPLY_DECISIONS.OUTPUT_LIMIT; keepText: boolean; retry: boolean }
	/** It came back with nothing: retry or end. */
	| { kind: typeof REPLY_DECISIONS.EMPTY_REPLY; retry: boolean };

/**
 * Decides what to do with a reply.
 *
 * @remarks
 * At most one retry per model step: a reply to a retry is never retried, whatever went wrong with it, so a reply cut
 * off at the output limit, then an empty retry, ends the run.
 *
 * @param response - The reply's text, tool calls and stop reason.
 * @param previous - What the request that produced it retried, if it was a retry.
 * @param retries - Which retries the consumer allows.
 * @returns The action, and for a failed reply whether to retry it.
 */
export const decideReply = (
	response: Pick<FinalResponse, 'text' | 'toolCalls' | 'stopReason'>,
	previous: RetryKind | undefined,
	retries: RetrySettings,
): ReplyDecision => {
	if (response.toolCalls.length > 0) {
		return { kind: REPLY_DECISIONS.TOOL_CALLS };
	}
	const hasText = response.text.trim().length > 0;
	const mayRetry = previous === undefined;
	if (response.stopReason === STOP_REASONS.LENGTH) {
		return {
			kind: REPLY_DECISIONS.OUTPUT_LIMIT,
			keepText: hasText,
			retry: !hasText && mayRetry && retries.outputLimit,
		};
	}
	if (!hasText) {
		return { kind: REPLY_DECISIONS.EMPTY_REPLY, retry: mayRetry && retries.emptyReply };
	}
	return { kind: REPLY_DECISIONS.ANSWERED };
};
