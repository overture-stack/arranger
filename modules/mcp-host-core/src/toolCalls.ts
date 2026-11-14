// Running a reply's tool calls on a run's behalf: routing, the data-crossing guard, approval, the call itself, and
// its tool message. Also the bridge that puts a server's question to the consumer while a call waits on it.
import { type ElicitResult, type InputQuestion } from '@overture-stack/arranger-mcp-client';

import { type Answer, approvalAnswer, confirmationAnswer, type PendingQuestion, type Settled } from './answers.js';
import {
	APPROVAL_DECISIONS,
	DENIED_BY,
	DONE_REASONS,
	EVENT_TYPES,
	HOST_OUTCOMES,
	ID_PREFIXES,
	QUESTION_KINDS,
	SETTLED_BY,
	STOPPED,
	TOOL_CALL_KINDS,
} from './constants.js';
import { restrictedDataFrom } from './crossing.js';
import { type EventBody } from './events.js';
import { functionCall, functionCallOutput } from './messages.js';
import { type ProviderMalformedCall, type ProviderToolCall } from './provider.js';
import { type RegisteredTool } from './registry.js';
import { type Ended, type Run } from './run.js';
import {
	capToolMessage,
	type HostOutcome,
	TOOL_MESSAGES,
	type ToolCallOutcome,
	toolMessageFor,
} from './toolMessages.js';
import { errorMessage, isRecord, parseJson, untilAborted } from './utils.js';

/** A call the model made, parsed or not. */
type ModelCall = ProviderToolCall | ProviderMalformedCall;

/** Writes a call's tool message, capped to the configured length, and reports how the call ended. */
const answer = (
	run: Run,
	callId: string,
	outcome: ToolCallOutcome,
	route?: RegisteredTool,
	override?: string,
): void => {
	const message = toolMessageFor(outcome);
	const text = override ?? capToolMessage(message.text, run.options.toolResultMaxChars);
	run.state.items.push(functionCallOutput(callId, text, message.isError));
	run.emit({
		type: EVENT_TYPES.TOOL_RESULT,
		callId,
		...(route && { server: route.server, tool: route.tool.name }),
		outcome,
		isError: message.isError,
	});
};

/**
 * Puts a question to the consumer, announces it, and waits for it to settle.
 *
 * @remarks
 * The question is registered before its event, so a listener can answer from inside it. A question withdrawn
 * because its signal aborted is announced as `question_withdrawn`, and the abort rethrown.
 *
 * @param question - The question, listed by `pending()` until it settles.
 * @param accept - Whether an answer has the right shape for this question.
 * @param timeoutMs - How long to wait; `undefined` for no limit.
 * @param signal - Withdraws the question.
 * @param announcement - The event that asks the consumer.
 */
const askConsumer = async <T extends Answer>(
	run: Run,
	question: PendingQuestion,
	accept: (answer: Answer) => answer is T,
	timeoutMs: number | undefined,
	signal: AbortSignal,
	announcement: EventBody,
): Promise<Settled<T>> => {
	const asked = run.questions.ask(question, accept, timeoutMs, signal);
	run.emit(announcement);
	try {
		return await asked;
	} catch (error) {
		run.emit({
			type: EVENT_TYPES.QUESTION_WITHDRAWN,
			id: question.id,
			kind: question.kind,
			callId: question.callId,
		});
		throw error;
	}
};

/**
 * Asks the approval policy about a call, and the consumer when the policy says `ask`.
 *
 * @remarks
 * The policy sees a copy of the call, so it cannot change what runs. A policy that throws or returns something
 * other than a decision denies the call, as `policy_error`.
 *
 * @returns `allow`, how the call was denied, or a stop when the run was aborted while deciding.
 */
const approve = async (
	run: Run,
	callId: string,
	route: RegisteredTool,
	args: Record<string, unknown>,
): Promise<
	typeof APPROVAL_DECISIONS.ALLOW | typeof STOPPED | Extract<HostOutcome, { outcome: typeof HOST_OUTCOMES.DENIED }>
> => {
	const call = { callId, server: route.server, tool: route.tool.name, arguments: args };
	let decision: unknown;
	try {
		decision = await untilAborted(
			Promise.resolve(run.options.approvalPolicy({ call: structuredClone(call) })),
			run.signal,
		);
	} catch (error) {
		return run.signal.aborted
			? STOPPED
			: { outcome: HOST_OUTCOMES.DENIED, by: DENIED_BY.POLICY_ERROR, message: errorMessage(error) };
	}
	switch (decision) {
		case APPROVAL_DECISIONS.ALLOW:
			return APPROVAL_DECISIONS.ALLOW;
		case APPROVAL_DECISIONS.DENY:
			return { outcome: HOST_OUTCOMES.DENIED, by: DENIED_BY.POLICY };
		case APPROVAL_DECISIONS.ASK:
			break;
		default:
			return {
				outcome: HOST_OUTCOMES.DENIED,
				by: DENIED_BY.POLICY_ERROR,
				message: `Not a decision: ${JSON.stringify(decision)}`,
			};
	}

	if (run.signal.aborted) {
		return STOPPED;
	}
	const id = `${callId}/approval`;
	let settled: Settled<{ approve: boolean }>;
	try {
		settled = await askConsumer(
			run,
			{ kind: QUESTION_KINDS.APPROVAL, id, runId: run.id, ...call, askedAt: new Date().toISOString() },
			approvalAnswer,
			run.options.approvalTimeoutMs,
			run.signal,
			{ type: EVENT_TYPES.APPROVAL_REQUIRED, id, ...call },
		);
	} catch {
		return STOPPED;
	}
	const approved = settled.by === SETTLED_BY.ANSWER && settled.answer.approve;
	run.emit({
		type: EVENT_TYPES.APPROVAL_ANSWERED,
		id,
		callId,
		decision: approved ? APPROVAL_DECISIONS.ALLOW : APPROVAL_DECISIONS.DENY,
		timedOut: settled.by === SETTLED_BY.TIMEOUT,
		waitedMs: settled.waitedMs,
	});
	if (approved) {
		return APPROVAL_DECISIONS.ALLOW;
	}
	return {
		outcome: HOST_OUTCOMES.DENIED,
		by: settled.by === SETTLED_BY.TIMEOUT ? DENIED_BY.TIMEOUT : DENIED_BY.PERSON,
	};
};

/**
 * Runs one call and writes its tool message.
 *
 * @remarks
 * In order: a malformed call, an unknown tool or arguments that are not a JSON object end it before anything is
 * sent; a call that would carry another server's restricted data is refused; the approval policy decides the rest,
 * and asks the consumer where it says to.
 */
const runCall = async (run: Run, turn: number, call: ModelCall, callId: string): Promise<void> => {
	if (call.kind === TOOL_CALL_KINDS.MALFORMED) {
		run.emit({ type: EVENT_TYPES.MALFORMED_TOOL_CALL, turn, callId, call });
		answer(run, callId, { outcome: HOST_OUTCOMES.MALFORMED });
		return;
	}

	const route = run.registry.byName.get(call.name);
	if (!route) {
		answer(run, callId, { outcome: HOST_OUTCOMES.UNKNOWN_TOOL });
		return;
	}

	const args = parseJson(call.arguments);
	if (!isRecord(args)) {
		const malformed: ProviderMalformedCall = {
			kind: TOOL_CALL_KINDS.MALFORMED,
			...(call.id !== undefined && { id: call.id }),
			name: call.name,
			raw: call.arguments,
		};
		run.emit({ type: EVENT_TYPES.MALFORMED_TOOL_CALL, turn, callId, call: malformed });
		answer(run, callId, { outcome: HOST_OUTCOMES.MALFORMED });
		return;
	}

	run.emit({
		type: EVENT_TYPES.TOOL_CALL,
		callId,
		...(call.id !== undefined && { modelCallId: call.id }),
		name: call.name,
		server: route.server,
		tool: route.tool.name,
		arguments: call.arguments,
	});

	// Refused before the policy, so no one is ever asked to approve a crossing.
	// `McpHost.create` leaves no such call (see `assertServersApart`); this guards against a fault there.
	const heldFrom = restrictedDataFrom(run.state.servers, route.server);
	if (heldFrom.length > 0) {
		answer(run, callId, { outcome: HOST_OUTCOMES.CROSSING_REFUSED, server: route.server, heldFrom }, route);
		return;
	}

	const approval = await approve(run, callId, route, args);
	if (approval === STOPPED) {
		answer(run, callId, { outcome: HOST_OUTCOMES.NOT_RUN }, route);
		return;
	}
	if (approval !== APPROVAL_DECISIONS.ALLOW) {
		answer(run, callId, approval, route);
		return;
	}

	const server = run.connections.get(route.server);
	if (!server) {
		answer(run, callId, { outcome: HOST_OUTCOMES.UNKNOWN_TOOL });
		return;
	}
	run.inFlight = callId;
	const outcome = await server.client.callTool(callId, route.tool.name, args, { signal: run.signal });
	run.inFlight = undefined;
	run.state.calls.push({
		callId,
		server: route.server,
		tool: route.tool.name,
		containsOnlyOpenData: server.containsOnlyOpenData,
	});
	// The server's own text reaches the model only in a result or a rejection; every other tool message is fixed.
	if (outcome.outcome === 'result' || outcome.outcome === 'rejected') {
		run.markReturned(route.server);
	}

	if (outcome.outcome === 'input_state_rejected') {
		run.emit({
			type: EVENT_TYPES.INPUT_STATE_REJECTED,
			callId,
			server: route.server,
			waitedMs: outcome.waitedMs,
		});
	}
	// A call the time limit cut off was not the user's doing, and whether it ran is unknown.
	const override = outcome.outcome === 'cancelled' && run.timedOut ? TOOL_MESSAGES.transportError : undefined;
	answer(run, callId, outcome, route, override);
};

/**
 * Records every call of a reply, then runs them one at a time, in order.
 *
 * @remarks
 * Every call is recorded first, so each has its place in the conversation however the run ends. Once the run is
 * stopped or reaches its tool-call limit, each remaining call gets "stopped before this call".
 *
 * @param run - The run the reply belongs to.
 * @param turn - The turn that produced the reply.
 * @param calls - The reply's calls, in the order the model made them.
 * @returns How the run ended, or `undefined` to ask the model again.
 */
export const runCalls = async (run: Run, turn: number, calls: readonly ModelCall[]): Promise<Ended | undefined> => {
	const numbered = calls.map((call) => ({ call, callId: run.nextId(ID_PREFIXES.CALL) }));
	run.latestCalls = new Set(numbered.map(({ callId }) => callId));
	for (const { call, callId } of numbered) {
		run.state.items.push(
			functionCall({
				callId,
				...(call.id !== undefined && { modelCallId: call.id }),
				name: call.name ?? '',
				arguments: call.kind === TOOL_CALL_KINDS.CALL ? call.arguments : call.raw,
			}),
		);
	}

	let ended: Ended | undefined;
	for (const { call, callId } of numbered) {
		if (!ended && run.signal.aborted) {
			ended = run.stopped();
		}
		if (!ended && run.toolCalls >= run.options.limits.toolCalls) {
			ended = { reason: DONE_REASONS.TOOL_CALL_LIMIT };
		}
		if (ended) {
			answer(run, callId, { outcome: HOST_OUTCOMES.NOT_RUN });
			continue;
		}
		run.toolCalls += 1;
		await runCall(run, turn, call, callId);
	}
	return ended ?? (run.signal.aborted ? run.stopped() : undefined);
};

/**
 * Bridges a server's question, from inside a call, to the consumer.
 *
 * @param run - The active run.
 * @param server - The key of the server asking.
 * @param question - The question, as `mcp-client` gives it.
 * @returns The consumer's answer, or `cancel` when the question timed out.
 * @throws The question's abort reason when its call or run is cancelled, so `mcp-client` withdraws it.
 */
export const resolveQuestion = async (run: Run, server: string, question: InputQuestion): Promise<ElicitResult> => {
	const { questionId, callId, round, key, message, requestedSchema, signal } = question;
	// Never announce a question that could not be answered.
	signal.throwIfAborted();
	const { confirmations } = run.options;
	const settled = await askConsumer(
		run,
		{
			kind: QUESTION_KINDS.CONFIRMATION,
			id: questionId,
			runId: run.id,
			callId,
			server,
			round,
			key,
			message,
			requestedSchema,
			askedAt: new Date().toISOString(),
		},
		confirmationAnswer,
		confirmations === false ? undefined : confirmations.timeoutMs,
		signal,
		{ type: EVENT_TYPES.INPUT_REQUIRED, questionId, callId, server, round, key, message, requestedSchema },
	);
	const result: ElicitResult = settled.by === SETTLED_BY.ANSWER ? settled.answer : { action: 'cancel' };
	run.emit({
		type: EVENT_TYPES.INPUT_ANSWERED,
		questionId,
		answer: result,
		waitedMs: settled.waitedMs,
		timedOut: settled.by === SETTLED_BY.TIMEOUT,
	});
	return result;
};
