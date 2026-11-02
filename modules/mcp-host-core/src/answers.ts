// Questions waiting on the consumer: pre-call approvals, and server confirmations bridged from `mcp-client`'s
// resolver. Host-core keeps the only clocks on them, so `respond`, `pending()` and the events always match what the
// server was sent.
import { type ElicitResult } from '@overture-stack/arranger-mcp-client';

import { QUESTION_CLOSURES, QUESTION_KINDS, RESPOND_RESULTS, SETTLED_BY } from './constants.js';
import { isRecord, type ObjectValues } from './utils.js';

/** A tool call as the approval policy, and a person asked to approve it, see it. */
export type ApprovalCall = {
	callId: string;
	server: string;
	tool: string;
	arguments: Record<string, unknown>;
};

/** A pre-call approval the policy asked the consumer for. */
export type PendingApproval = ApprovalCall & {
	kind: typeof QUESTION_KINDS.APPROVAL;
	/** `${callId}/approval`. */
	id: string;
	runId: string;
	/** When it was asked, as ISO 8601. */
	askedAt: string;
};

/** A server's question, from inside a call. */
export type PendingConfirmation = {
	kind: typeof QUESTION_KINDS.CONFIRMATION;
	/** The question id, `${callId}/${round}/${key}`. */
	id: string;
	runId: string;
	callId: string;
	server: string;
	round: number;
	key: string;
	/** Untrusted text from the server: render it as text, never HTML. */
	message: string;
	requestedSchema: unknown;
	askedAt: string;
};

/** A question still waiting for {@link QuestionTable.respond}. */
export type PendingQuestion = PendingApproval | PendingConfirmation;

/** An approval's answer, or a confirmation's: `decline` and `cancel` are answers too. */
export type Answer = { approve: boolean } | ElicitResult;

/**
 * What {@link QuestionTable.respond} did.
 */
export type RespondResult = ObjectValues<typeof RESPOND_RESULTS>;

/** How a question was settled, and how long it waited. */
export type Settled<T> =
	| { by: typeof SETTLED_BY.ANSWER; answer: T; waitedMs: number }
	| { by: typeof SETTLED_BY.TIMEOUT; waitedMs: number };

/** How a question closed, for an answer that arrives after it. */
type Closure = ObjectValues<typeof QUESTION_CLOSURES>;

/** An open question, with the check its answer must pass and the function that settles it. */
type Entry = {
	question: PendingQuestion;
	accept: (answer: Answer) => boolean;
	settle: (answer: Answer) => void;
};

/** Reads an approval's answer. */
export const approvalAnswer = (answer: Answer): answer is { approve: boolean } =>
	'approve' in answer && typeof answer.approve === 'boolean';

/** Reads a confirmation's answer. */
export const confirmationAnswer = (answer: Answer): answer is ElicitResult =>
	'action' in answer &&
	(answer.action === 'accept' || answer.action === 'decline' || answer.action === 'cancel') &&
	(answer.content === undefined || isRecord(answer.content));

/** The open and settled questions of one conversation. */
export class QuestionTable {
	readonly #open = new Map<string, Entry>();
	readonly #closed = new Map<string, Closure>();

	/**
	 * Waits for an answer to a question.
	 *
	 * @param question - The question, listed by {@link pending} until it settles.
	 * @param accept - Whether an answer has the right shape for this question.
	 * @param timeoutMs - How long to wait; `undefined` for no limit.
	 * @param signal - Withdraws the question.
	 * @returns The answer, or a timeout.
	 * @throws The signal's reason when it aborts first.
	 */
	ask<T extends Answer>(
		question: PendingQuestion,
		accept: (answer: Answer) => answer is T,
		timeoutMs: number | undefined,
		signal: AbortSignal,
	): Promise<Settled<T>> {
		const { id } = question;
		if (this.#open.has(id) || this.#closed.has(id)) {
			return Promise.reject(new Error(`Question ${id} was already asked`));
		}
		if (signal.aborted) {
			return Promise.reject(signal.reason);
		}

		return new Promise<Settled<T>>((resolve, reject) => {
			const startedMs = Date.now();
			const waited = () => Date.now() - startedMs;
			const listening = new AbortController();
			let timer: ReturnType<typeof setTimeout> | undefined;
			const close = (how: Closure) => {
				this.#open.delete(id);
				this.#closed.set(id, how);
				clearTimeout(timer);
				listening.abort();
			};

			signal.addEventListener(
				'abort',
				() => {
					close(QUESTION_CLOSURES.WITHDRAWN);
					reject(signal.reason);
				},
				{ once: true, signal: listening.signal },
			);
			if (timeoutMs !== undefined) {
				timer = setTimeout(() => {
					close(QUESTION_CLOSURES.TIMED_OUT);
					resolve({ by: SETTLED_BY.TIMEOUT, waitedMs: waited() });
				}, timeoutMs);
			}
			this.#open.set(id, {
				question,
				accept,
				settle: (answer) => {
					close(QUESTION_CLOSURES.ANSWERED);
					resolve({ by: SETTLED_BY.ANSWER, answer: answer as T, waitedMs: waited() });
				},
			});
		});
	}

	/**
	 * Answers a question by id. Idempotent: only the first answer counts.
	 *
	 * @param id - An id from {@link pending} or an `approval_required` or `input_required` event.
	 * @param answer - `{ approve }` for an approval; an `ElicitResult` for a confirmation.
	 * @returns What happened to the answer.
	 * @throws `TypeError` when the answer does not fit the question, which leaves it open.
	 */
	respond(id: string, answer: Answer): RespondResult {
		const entry = this.#open.get(id);
		if (!entry) {
			switch (this.#closed.get(id)) {
				case undefined:
					return RESPOND_RESULTS.UNKNOWN;
				case QUESTION_CLOSURES.TIMED_OUT:
					return RESPOND_RESULTS.TIMED_OUT;
				case QUESTION_CLOSURES.ANSWERED:
				case QUESTION_CLOSURES.WITHDRAWN:
					return RESPOND_RESULTS.ALREADY_ANSWERED;
			}
		}
		if (!entry.accept(answer)) {
			throw new TypeError(`The answer does not fit ${entry.question.kind} ${id}`);
		}
		entry.settle(answer);
		return RESPOND_RESULTS.ACCEPTED;
	}

	/** The questions still open, oldest first. */
	pending(): PendingQuestion[] {
		return [...this.#open.values()].map(({ question }) => ({ ...question }));
	}

	/** Whether a call is waiting on a server's question. */
	isConfirming(callId: string): boolean {
		return [...this.#open.values()].some(
			({ question }) => question.kind === QUESTION_KINDS.CONFIRMATION && question.callId === callId,
		);
	}
}
