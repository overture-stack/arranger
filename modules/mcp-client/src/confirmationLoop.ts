import { setTimeout as sleep } from 'node:timers/promises';

import { type ElicitResult, type InputRequiredResult, isInputRequiredResult } from '@modelcontextprotocol/client';

import { isRecord } from './json.js';
import { type CallOutcome, classifyError, errorMessage, type OutcomeFields } from './outcomes.js';
import { type InputResolver, type RoundInfo } from './types.js';

/** Retries allowed after the original request, as in the SDK. */
export const DEFAULT_MAX_ROUNDS = 10;

/** The pause before resending a round without questions, as in the SDK. */
export const STATE_ONLY_ROUND_PAUSE_MS = 250;

/**
 * Sends one request leg.
 *
 * @param params - The request's params, with any retry fields added.
 * @returns The server's result. Rejects with whatever the SDK threw.
 */
export type SendLeg = (params: Record<string, unknown>) => Promise<unknown>;

/** One request for {@link runConfirmationLoop} to drive. */
export type ConfirmationLoopOptions = {
	/** The host's id for the request. */
	callId: string;
	/** The original request's params. */
	params: Record<string, unknown>;
	send: SendLeg;
	/** Without one, any question fails the call. */
	resolver?: InputResolver;
	/** @defaultValue {@link DEFAULT_MAX_ROUNDS} */
	maxRounds?: number;
	signal?: AbortSignal;
	onRound?: (round: RoundInfo) => void;
};

/** Thrown inside the loop to end it with an outcome; never escapes. */
class EndCall {
	constructor(readonly fields: OutcomeFields<never>) {}
}

/** A question checked as answerable, bound to the resolver. */
type Question = {
	key: string;
	ask: (signal: AbortSignal) => Promise<readonly [string, ElicitResult]>;
};

/** The method an unanswerable request names, for its outcome; URL-mode elicitation shows its mode. */
const describeRequest = (request: unknown): string => {
	if (!isRecord(request) || typeof request.method !== 'string') {
		return 'a malformed request';
	}
	const mode = isRecord(request.params) ? request.params.mode : undefined;
	return request.method === 'elicitation/create' && mode !== undefined && mode !== 'form'
		? `elicitation/create (${String(mode)})`
		: request.method;
};

/** Whether a request is a form-mode elicitation this client can put to the resolver. */
const isFormQuestion = (
	request: unknown,
): request is { method: 'elicitation/create'; params: { message: string; requestedSchema: Record<string, unknown> } } =>
	isRecord(request) &&
	request.method === 'elicitation/create' &&
	isRecord(request.params) &&
	(request.params.mode ?? 'form') === 'form' &&
	typeof request.params.message === 'string' &&
	isRecord(request.params.requestedSchema);

/**
 * Checks every question in a round before any is asked, so an unanswerable round asks the person nothing.
 *
 * @remarks
 * The SDK checks only that `inputRequests` is an object, so each entry's shape is checked here.
 *
 * @throws {@link EndCall} with `input_failed`, for a request that is not a well-formed form, or when there is no
 * resolver.
 */
const formQuestions = (
	value: InputRequiredResult,
	resolver: InputResolver | undefined,
	callId: string,
	round: number,
): Question[] =>
	Object.entries((value.inputRequests ?? {}) as Record<string, unknown>).map(([key, request]) => {
		if (!isFormQuestion(request) || !resolver) {
			const method = describeRequest(request);
			throw new EndCall({
				outcome: 'input_failed',
				reason: 'unsupported_request',
				key,
				method,
				message: resolver
					? `The server asked for ${method}, which this client does not support`
					: `The server asked for ${method}, but no input resolver is configured`,
			});
		}
		const { message, requestedSchema } = request.params;
		return {
			key,
			ask: async (signal) => {
				const answer = await resolver({
					questionId: `${callId}/${round}/${key}`,
					callId,
					round,
					key,
					message,
					requestedSchema,
					signal,
				});
				return [key, answer] as const;
			},
		};
	});

/**
 * Drives a request through `input_required` rounds by hand.
 *
 * @remarks
 * Each question goes to the resolver, and the retry carries the answers and the round's `requestState`, echoed
 * byte for byte.
 *
 * @param options - The request, how to send it, and how to answer it.
 * @returns How the request ended. Never rejects: anything thrown becomes the outcome.
 */
export const runConfirmationLoop = async <T>({
	callId,
	params,
	send,
	resolver,
	maxRounds = DEFAULT_MAX_ROUNDS,
	signal,
	onRound,
}: ConfirmationLoopOptions): Promise<CallOutcome<T>> => {
	const started = performance.now();
	let waitingMs = 0;
	let lastWaitMs = 0;
	let rounds = 0;
	let retry: { inputResponses?: Record<string, ElicitResult>; requestState?: string } = {};

	const finish = (fields: OutcomeFields<T>): CallOutcome<T> => ({
		...fields,
		wireMs: Math.round(performance.now() - started - waitingMs),
		waitingMs: Math.round(waitingMs),
		rounds,
	});

	try {
		while (true) {
			if (signal?.aborted) {
				return finish({ outcome: 'cancelled' });
			}

			let value: unknown;
			try {
				value = await send({ ...params, ...retry });
			} catch (error) {
				return finish(
					classifyError(error, {
						aborted: signal?.aborted ?? false,
						carriedRequestState: retry.requestState !== undefined,
						waitedMs: Math.round(lastWaitMs),
					}),
				);
			}

			if (!isInputRequiredResult(value)) {
				return finish({ outcome: 'result', result: value as T });
			}

			rounds += 1;
			if (rounds > maxRounds) {
				return finish({ outcome: 'rounds_exceeded', maxRounds });
			}

			const round = rounds;
			try {
				onRound?.({
					callId,
					round,
					...(value.requestState !== undefined && { requestState: value.requestState }),
					keys: Object.keys(value.inputRequests ?? {}),
				});
			} catch (error) {
				throw new EndCall({ outcome: 'input_failed', reason: 'resolver_error', message: errorMessage(error) });
			}
			const questions = formQuestions(value, resolver, callId, round);

			const waitStarted = performance.now();
			let inputResponses: Record<string, ElicitResult> | undefined;

			if (questions.length === 0) {
				try {
					await sleep(STATE_ONLY_ROUND_PAUSE_MS, undefined, signal && { signal });
				} catch {
					return finish({ outcome: 'cancelled' });
				}
				lastWaitMs = performance.now() - waitStarted;
			} else {
				// One round's questions are answered together; the first failure withdraws the rest.
				const roundController = new AbortController();
				const onAbort = () => roundController.abort(signal?.reason);
				signal?.addEventListener('abort', onAbort, { once: true });
				if (signal?.aborted) {
					onAbort();
				}
				// An abort ends the wait even if a resolver ignores its signal.
				const withdrawn = new Promise<never>((_resolve, reject) => {
					roundController.signal.addEventListener('abort', () => reject(roundController.signal.reason), {
						once: true,
					});
				});
				withdrawn.catch(() => undefined);
				let failure: { error: unknown } | undefined;
				try {
					const answers = await Promise.race([
						Promise.all(questions.map(({ ask }) => ask(roundController.signal))),
						withdrawn,
					]);
					inputResponses = Object.fromEntries(answers);
				} catch (error) {
					failure = { error };
					roundController.abort(error);
				} finally {
					signal?.removeEventListener('abort', onAbort);
				}
				// Recorded before any return, so a cancelled or failed call still reports how long it waited.
				lastWaitMs = performance.now() - waitStarted;
				waitingMs += lastWaitMs;

				if (failure) {
					if (signal?.aborted) {
						return finish({ outcome: 'cancelled' });
					}
					throw new EndCall({
						outcome: 'input_failed',
						reason: 'resolver_error',
						message: errorMessage(failure.error),
					});
				}
			}

			retry = {
				...(inputResponses && { inputResponses }),
				...(value.requestState !== undefined && { requestState: value.requestState }),
			};
		}
	} catch (error) {
		// Nothing else should reach here, but a call must never reject.
		return finish(
			error instanceof EndCall
				? error.fields
				: { outcome: 'transport_error', kind: 'unknown', message: errorMessage(error) },
		);
	}
};
