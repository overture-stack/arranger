// The conversation's items, shaped after the Responses API's (MCP Host Plan §2.2, Model Provider Analysis §3).
// Only this file and `state.ts` know the shapes: everything else uses the constructors and readers below, so a
// change of shape stays here.
import { isRecord } from './json.js';

/** A person's message, or a prompt's user turn. */
export type UserMessage = { type: 'message'; role: 'user'; text: string };

/** The model's text, or a prompt's assistant turn. */
export type AssistantMessage = {
	type: 'message';
	role: 'assistant';
	text: string;
	/** Reasoning the model returned. The provider decides whether to send it back. */
	reasoning?: string;
	/** Set when the reply was cut off at the output limit. */
	truncated?: true;
	/** Opaque to host-core, such as encrypted reasoning, for the provider that produced them. */
	providerItems?: unknown[];
};

/** A tool call the model made, well-formed or not. */
export type FunctionCall = {
	type: 'function_call';
	/** Host-core's id, unique within the conversation. */
	callId: string;
	/** The id the model gave the call, as received. */
	modelCallId?: string;
	/** The model-facing tool name, as received. */
	name: string;
	/** The arguments as received, unparsed. */
	arguments: string;
};

/** The tool message for one call: what the model is sent about it. */
export type FunctionCallOutput = {
	type: 'function_call_output';
	callId: string;
	output: string;
	isError: boolean;
};

/** One item of a conversation. */
export type ConversationItem = UserMessage | AssistantMessage | FunctionCall | FunctionCallOutput;

/**
 * A person's message.
 *
 * @param text - What they wrote, or a prompt's user turn.
 */
export const userMessage = (text: string): UserMessage => ({ type: 'message', role: 'user', text });

/**
 * The model's text.
 *
 * @param text - The visible reply, which may be empty when only reasoning or provider items came back.
 * @param extras - Reasoning, the cut-off mark, and provider-specific items, each kept only when set.
 */
export const assistantMessage = (
	text: string,
	extras: Pick<AssistantMessage, 'reasoning' | 'truncated' | 'providerItems'> = {},
): AssistantMessage => ({
	type: 'message',
	role: 'assistant',
	text,
	...(extras.reasoning !== undefined && { reasoning: extras.reasoning }),
	...(extras.truncated && { truncated: true }),
	...(extras.providerItems !== undefined && { providerItems: extras.providerItems }),
});

/**
 * A tool call the model made.
 *
 * @param call - Host-core's call id, the model's own id when it gave one, and the name and arguments as received.
 */
export const functionCall = (call: Omit<FunctionCall, 'type'>): FunctionCall => ({
	type: 'function_call',
	callId: call.callId,
	...(call.modelCallId !== undefined && { modelCallId: call.modelCallId }),
	name: call.name,
	arguments: call.arguments,
});

/**
 * The tool message for a call.
 *
 * @param callId - Host-core's id for the call it answers.
 * @param output - What the model is sent about the call.
 * @param isError - Whether the call failed, or did not run.
 */
export const functionCallOutput = (callId: string, output: string, isError: boolean): FunctionCallOutput => ({
	type: 'function_call_output',
	callId,
	output,
	isError,
});

/** Whether an item is a tool call. */
export const isFunctionCall = (item: ConversationItem): item is FunctionCall => item.type === 'function_call';

/** Whether an item is a tool message. */
export const isFunctionCallOutput = (item: ConversationItem): item is FunctionCallOutput =>
	item.type === 'function_call_output';

/** Whether an item is a person's or the model's message. */
export const isMessage = (item: ConversationItem): item is UserMessage | AssistantMessage => item.type === 'message';

/**
 * Checks that a value read back from storage has an item's shape.
 *
 * @param value - Anything, such as one entry of a saved state's items.
 * @returns Whether it has its type's required fields, with the right types.
 */
export const isConversationItem = (value: unknown): value is ConversationItem => {
	if (!isRecord(value)) {
		return false;
	}
	switch (value.type) {
		case 'message':
			return (value.role === 'user' || value.role === 'assistant') && typeof value.text === 'string';
		case 'function_call':
			return (
				typeof value.callId === 'string' &&
				typeof value.name === 'string' &&
				typeof value.arguments === 'string'
			);
		case 'function_call_output':
			return (
				typeof value.callId === 'string' &&
				typeof value.output === 'string' &&
				typeof value.isError === 'boolean'
			);
		default:
			return false;
	}
};

/**
 * Finds the calls that have no tool message yet.
 *
 * @param items - The conversation.
 * @returns The unanswered calls, in order.
 */
export const unansweredCalls = (items: readonly ConversationItem[]): FunctionCall[] => {
	const answered = new Set(items.filter(isFunctionCallOutput).map(({ callId }) => callId));
	return items.filter(isFunctionCall).filter(({ callId }) => !answered.has(callId));
};

/**
 * Counts the characters of an item that a provider sends, for the context-window estimate.
 *
 * @param item - One item of the conversation.
 * @param sendsReasoning - Whether the provider sends an assistant turn's reasoning back, so that it counts too.
 * @returns The characters sent. Provider items are left out, since they are opaque.
 */
export const sentCharacters = (item: ConversationItem, sendsReasoning = false): number => {
	switch (item.type) {
		case 'message':
			return item.text.length + (sendsReasoning && item.role === 'assistant' ? (item.reasoning?.length ?? 0) : 0);
		case 'function_call':
			return item.name.length + item.arguments.length;
		case 'function_call_output':
			return item.output.length;
	}
};
