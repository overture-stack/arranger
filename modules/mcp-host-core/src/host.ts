import { type ElicitResult, type InputQuestion } from '@overture-stack/arranger-mcp-client';

import { type Answer, type PendingQuestion, QuestionTable, type RespondResult } from './answers.js';
import { Connections } from './connections.js';
import { CALL_STANDINGS } from './constants.js';
import { assertServersApart, identifyEndpoint } from './crossing.js';
import { type RunSummary } from './events.js';
import { type McpHostOptions, type RunInput, validateOptions } from './options.js';
import { type ModelSurface, toModelSurface } from './registry.js';
import { type Ended, Run } from './run.js';
import { type CallStanding, type ConversationState, emptyState, restoreState, withEveryCallAnswered } from './state.js';
import { resolveQuestion } from './toolCalls.js';

/** A run was started while another was active in the same conversation. */
export class RunActiveError extends Error {
	constructor() {
		super('A run is already active in this conversation');
		this.name = 'RunActiveError';
	}
}

/**
 * One conversation: a model, a set of MCP servers, and the runs between them.
 *
 * @remarks
 * Holds one `McpClient` per server, and runs one run at a time. Every event is plain data.
 */
export class McpHost {
	readonly #options: McpHostOptions;
	readonly #connections: Connections;
	readonly #questions = new QuestionTable();
	#state: ConversationState;
	#run: Run | undefined;

	/** Private: {@link McpHost.create} checks the options and the state, and connects, before a host exists. */
	private constructor(options: McpHostOptions, state: ConversationState) {
		this.#options = options;
		this.#state = state;
		this.#connections = new Connections(options, (server, question) => this.#resolve(server, question));
	}

	/**
	 * Connects to every server.
	 *
	 * @param options - The servers, provider, model, policy, limits and listener.
	 * @param signal - Aborts connecting.
	 * @returns A host ready to run.
	 * @throws `TypeError` for invalid options or saved state; `ServerSetError`, before connecting anything, when a
	 * server not flagged `containsOnlyOpenData` shares the conversation with another, a server would join one holding
	 * another server's restricted data, or a saved conversation holding restricted data or carried content would gain
	 * a server, including a key that now reaches another endpoint (see `identifyEndpoint`); and whatever connecting
	 * throws, after closing any server already connected.
	 */
	static async create(options: McpHostOptions, signal?: AbortSignal): Promise<McpHost> {
		validateOptions(options);
		const configured = options.servers.map(({ key, connection, containsOnlyOpenData }) => ({
			key,
			...identifyEndpoint(connection.url),
			containsOnlyOpenData: containsOnlyOpenData === true,
		}));
		const state = options.state === undefined ? emptyState(configured) : restoreState(options.state, configured);
		assertServersApart(configured, state.servers);
		const host = new McpHost(options, state);

		const connected = await Promise.allSettled(
			options.servers.map((config) => host.#connections.connect(config, signal)),
		);
		const failure = connected.find((result) => result.status === 'rejected');
		if (failure) {
			await host.close();
			throw failure.reason;
		}
		return host;
	}

	/**
	 * Answers an approval or a confirmation by id. Only the first answer counts.
	 *
	 * @param id - The id from `approval_required`, `input_required` or {@link McpHost.pending}.
	 * @param answer - `{ approve }` for an approval; an `ElicitResult` for a confirmation, where `decline` and
	 * `cancel` are answers too.
	 * @returns `accepted`; `unknown` for an id never issued; `already_answered`, including for a question withdrawn
	 * when its run was cancelled; or `timed_out`.
	 * @throws `TypeError` when the answer does not fit the question, which stays open.
	 */
	respond(id: string, answer: Answer): RespondResult {
		return this.#questions.respond(id, answer);
	}

	/** The approvals and confirmations still waiting, for a UI that reconnects. */
	pending(): PendingQuestion[] {
		return this.#questions.pending();
	}

	/**
	 * The conversation's state, to save and hand back to {@link McpHost.create}.
	 *
	 * @returns A copy in which every call has a tool message: "abandoned" for one waiting on a confirmation, which is
	 * never resumed.
	 */
	state(): ConversationState {
		return withEveryCallAnswered(this.#state, (callId): CallStanding => {
			if (this.#questions.isConfirming(callId)) {
				return CALL_STANDINGS.CONFIRMING;
			}
			return this.#run?.inFlight === callId ? CALL_STANDINGS.IN_FLIGHT : CALL_STANDINGS.QUEUED;
		});
	}

	/** The system prompt and tools the next run would send, from each server's latest snapshot. */
	surface(): ModelSurface {
		return toModelSurface({
			systemPrompt: this.#options.systemPrompt,
			servers: this.#connections.surfaceServers(),
		});
	}

	/** Closes every server's connection. */
	async close(): Promise<void> {
		await this.#connections.close();
	}

	/**
	 * Runs the model until it answers in text, a limit is reached, or the run is cancelled.
	 *
	 * @param input - The person's message, or a trusted server's prompt.
	 * @param options - `signal` cancels the run.
	 * @returns The `done` event, emitted once the run is over, so its listener can start the next run.
	 * @throws {@link RunActiveError} when a run is already active in this conversation, and `TypeError` when carried
	 * content is given to a conversation that has begun.
	 */
	async run(input: RunInput, options: { signal?: AbortSignal } = {}): Promise<RunSummary> {
		if (this.#run) {
			throw new RunActiveError();
		}
		if ('carried' in input && input.carried && this.#state.items.length > 0) {
			throw new TypeError('Carried content can only start a new conversation');
		}
		const run = new Run(
			{
				options: this.#options,
				state: this.#state,
				connections: this.#connections,
				questions: this.#questions,
			},
			options.signal,
		);
		this.#run = run;
		let ended: Ended;
		try {
			ended = await run.execute(input);
		} finally {
			this.#run = undefined;
		}
		return run.done(ended);
	}

	/** Bridges a server's question to the consumer through the active run, or cancels it when none is active. */
	async #resolve(server: string, question: InputQuestion): Promise<ElicitResult> {
		const run = this.#run;
		return run ? resolveQuestion(run, server, question) : { action: 'cancel' };
	}
}
