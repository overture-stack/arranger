// What a run does with each model reply (MCP Host Plan §2.2, Agent Loop): run its tool calls, keep its answer, or
// retry or end after a reply cut off at the output limit or an empty one.
import { type FinalResponse } from './provider.js';

/** Why a request was sent again. */
export type RetryKind = 'empty_reply' | 'output_limit';

/** What to do with a reply. */
export type ReplyDecision =
	/** Run its tool calls, then ask the model again. */
	| { kind: 'tool_calls' }
	/** Keep its text as the answer, and end the run. */
	| { kind: 'answered' }
	/** It reached the output limit: keep any visible text, marked as cut off, and retry or end. */
	| { kind: 'output_limit'; keepText: boolean; retry: boolean }
	/** It came back with nothing: retry or end. */
	| { kind: 'empty_reply'; retry: boolean };

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
	retries: { emptyReply: boolean; outputLimit: boolean },
): ReplyDecision => {
	if (response.toolCalls.length > 0) {
		return { kind: 'tool_calls' };
	}
	const hasText = response.text.trim().length > 0;
	const mayRetry = previous === undefined;
	if (response.stopReason === 'length') {
		return { kind: 'output_limit', keepText: hasText, retry: !hasText && mayRetry && retries.outputLimit };
	}
	if (!hasText) {
		return { kind: 'empty_reply', retry: mayRetry && retries.emptyReply };
	}
	return { kind: 'answered' };
};
