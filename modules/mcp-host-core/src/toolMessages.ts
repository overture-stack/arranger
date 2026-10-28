// Every tool call gets one tool message, with fixed wording so transcripts compare (MCP Host Plan §2.2, Agent Loop).
import { type CallOutcome, type CallToolResult } from '@overture-stack/arranger-mcp-client';

/**
 * The fixed wording of every tool message host-core writes itself, from the plan's tool-message table, so
 * transcripts compare across runs and models. A `result` sends the tool's own content instead, and a crossing
 * refusal uses {@link crossingRefusedMessage}.
 */
export const TOOL_MESSAGES = {
	outputInvalid: "The result did not match the tool's declared output",
	rejected: 'The server rejected the call',
	inputStateRejected: 'The confirmation was no longer accepted; the call did not run',
	inputFailed: 'The confirmation could not be answered; the call did not run',
	roundsExceeded: 'The server kept asking for input; the call was abandoned',
	cancelled: 'The user cancelled the call',
	transportError: 'No usable answer came back; whether the call ran is unknown',
	denied: 'The user declined the call',
	malformed: 'The call could not be parsed',
	unknownTool: 'There is no tool with this name',
	notRun: 'The run stopped before this call',
	abandoned: 'The confirmation was abandoned; the call did not run',
} as const;

/**
 * The tool message for a call the approval policy refused as a crossing, naming the server and why, so the model
 * can explain it (data-crossing options §5).
 *
 * @param server - The server the call was to.
 * @param reason - The policy's reason, verbatim.
 */
export const crossingRefusedMessage = (server: string, reason: string): string =>
	`Calls to server "${server}" are refused in this conversation: ${reason}`;

/** How a call ended when host-core, not `mcp-client`, decided it. */
export type HostOutcome =
	| { outcome: 'denied'; by: 'policy' | 'person' | 'timeout' | 'policy_error'; message?: string }
	| { outcome: 'malformed' }
	| { outcome: 'unknown_tool' }
	| { outcome: 'not_run' }
	| { outcome: 'abandoned' }
	| { outcome: 'crossing_refused'; server: string; reason: string };

/** Every way a tool call can end. Plain data. */
export type ToolCallOutcome = CallOutcome<CallToolResult> | HostOutcome;

/** A tool message, before any length cap. */
export type ToolMessage = { text: string; isError: boolean };

type ContentBlock = CallToolResult['content'][number];

/**
 * The text of one content block, as the model is sent it.
 *
 * @param block - A tool result's or a prompt message's content.
 * @returns The text, a fixed placeholder for other content, or `undefined` for an unknown block type.
 */
export const renderContent = (block: ContentBlock): string | undefined => {
	switch (block.type) {
		case 'text':
			return block.text;
		case 'image':
		case 'audio':
			return `[${block.type} omitted]`;
		case 'resource':
			return `[resource omitted: ${block.resource.uri}]`;
		case 'resource_link':
			return `[resource link: ${block.uri}]`;
		default:
			return undefined;
	}
};

/**
 * The text of a tool result, as the model is sent it.
 *
 * @remarks
 * Text blocks are joined with newlines, and other blocks become a fixed placeholder. `structuredContent` is sent only
 * when there is no text block: the specification asks a server that returns it to send the same as text too.
 *
 * @param result - The tool's result.
 * @returns The text, which may be empty.
 */
export const renderToolResult = (result: CallToolResult): string => {
	const content = result.content ?? [];
	if (!content.some(({ type }) => type === 'text') && result.structuredContent !== undefined) {
		return JSON.stringify(result.structuredContent);
	}
	return content
		.map(renderContent)
		.filter((text) => text !== undefined)
		.join('\n');
};

/**
 * The tool message for a call's outcome.
 *
 * @param outcome - How the call ended.
 * @returns The fixed wording, or the result's text; an error unless the tool ran without `isError`.
 */
export const toolMessageFor = (outcome: ToolCallOutcome): ToolMessage => {
	switch (outcome.outcome) {
		case 'result':
			return { text: renderToolResult(outcome.result), isError: outcome.result.isError === true };
		case 'output_invalid':
			return { text: TOOL_MESSAGES.outputInvalid, isError: true };
		case 'rejected':
			return { text: `${TOOL_MESSAGES.rejected}: ${outcome.message}`, isError: true };
		case 'input_state_rejected':
			return { text: TOOL_MESSAGES.inputStateRejected, isError: true };
		case 'input_failed':
			return { text: TOOL_MESSAGES.inputFailed, isError: true };
		case 'rounds_exceeded':
			return { text: TOOL_MESSAGES.roundsExceeded, isError: true };
		case 'cancelled':
			return { text: TOOL_MESSAGES.cancelled, isError: true };
		case 'transport_error':
			return { text: TOOL_MESSAGES.transportError, isError: true };
		case 'denied':
			return { text: TOOL_MESSAGES.denied, isError: true };
		case 'malformed':
			return { text: TOOL_MESSAGES.malformed, isError: true };
		case 'unknown_tool':
			return { text: TOOL_MESSAGES.unknownTool, isError: true };
		case 'not_run':
			return { text: TOOL_MESSAGES.notRun, isError: true };
		case 'abandoned':
			return { text: TOOL_MESSAGES.abandoned, isError: true };
		case 'crossing_refused':
			return { text: crossingRefusedMessage(outcome.server, outcome.reason), isError: true };
	}
};

/**
 * Cuts a tool message to a length, noting the cut.
 *
 * @param text - The tool message.
 * @param maxChars - The cap; `undefined` for none.
 * @returns The text, cut with a note when it was longer than `maxChars`.
 */
export const capToolMessage = (text: string, maxChars: number | undefined): string =>
	maxChars === undefined || text.length <= maxChars
		? text
		: `${text.slice(0, maxChars)}\n[Result cut to ${maxChars} of ${text.length} characters]`;
