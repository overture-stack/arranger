// Questions waiting on the consumer: pre-call approvals, and server confirmations bridged from `mcp-client`'s
// resolver. Host-core keeps the only clocks on them, so `respond`, `pending()` and the events always match what the
// server was sent (MCP Host Plan §2.2, Events).
import { type ElicitResult } from '@overture-stack/arranger-mcp-client';

import { isRecord } from './json.js';

/** A pre-call approval the policy asked the consumer for. */
export type PendingApproval = {
	kind: 'approval';
	/** `${callId}/approval`. */
	id: string;
	runId: string;
	callId: string;
	server: string;
	tool: string;
	arguments: unknown;
	/** When it was asked, as ISO 8601. */
	askedAt: string;
};

/** A server's question, from inside a call. */
export type PendingConfirmation = {
	kind: 'confirmation';
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
 *
 * @remarks
 * `already_answered` also covers a question withdrawn because its call or run was cancelled.
 */
export type RespondResult = 'accepted' | 'unknown' | 'already_answered' | 'timed_out';

/** How a question was settled, and how long it waited. */
export type Settled<T> = { by: 'answer'; answer: T; waitedMs: number } | { by: 'timeout'; waitedMs: number };

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
	readonly #closed = new Map<string, 'answered' | 'timed_out' | 'withdrawn'>();

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
			const close = (how: 'answered' | 'timed_out' | 'withdrawn') => {
				this.#open.delete(id);
				this.#closed.set(id, how);
				clearTimeout(timer);
				listening.abort();
			};

			signal.addEventListener(
				'abort',
				() => {
					close('withdrawn');
					reject(signal.reason);
				},
				{ once: true, signal: listening.signal },
			);
			if (timeoutMs !== undefined) {
				timer = setTimeout(() => {
					close('timed_out');
					resolve({ by: 'timeout', waitedMs: waited() });
				}, timeoutMs);
			}
			this.#open.set(id, {
				question,
				accept,
				settle: (answer) => {
					close('answered');
					resolve({ by: 'answer', answer: answer as T, waitedMs: waited() });
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
			const closed = this.#closed.get(id);
			return closed === undefined ? 'unknown' : closed === 'timed_out' ? 'timed_out' : 'already_answered';
		}
		if (!entry.accept(answer)) {
			throw new TypeError(`The answer does not fit ${entry.question.kind} ${id}`);
		}
		entry.settle(answer);
		return 'accepted';
	}

	/** The questions still open, oldest first. */
	pending(): PendingQuestion[] {
		return [...this.#open.values()].map(({ question }) => ({ ...question }));
	}

	/** Whether a call is waiting on a server's question. */
	isConfirming(callId: string): boolean {
		return [...this.#open.values()].some(
			({ question }) => question.kind === 'confirmation' && question.callId === callId,
		);
	}
}
