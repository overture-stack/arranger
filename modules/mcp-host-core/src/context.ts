// Host-core never lets the serving stack truncate a conversation: Ollama drops the oldest messages first, the user's
// question among them, and answers anyway (MCP Host Plan §2.2, Context window).
import {
	type ConversationItem,
	functionCallOutput,
	isFunctionCall,
	isFunctionCallOutput,
	sentCharacters,
} from './messages.js';
import { type ToolDefinition } from './registry.js';

/** Characters per token for text not yet counted by the model server. Low, so the estimate errs high. */
export const DEFAULT_CHARS_PER_TOKEN = 3;

/** What to do when a request would not fit. */
export type ContextWindowSettings = {
	/** The model server's context window, in tokens. */
	tokens: number;
	/** `shorten` (`chat`, UI) stubs older tool results; `fail` (`eval`) ends the run instead. */
	policy: 'shorten' | 'fail';
	/** @defaultValue {@link DEFAULT_CHARS_PER_TOKEN} */
	charsPerToken?: number;
};

/** The previous turn's request size and the prompt tokens the server counted for it. */
export type Baseline = { inputTokens: number; sentChars: number; shortened: string[] };

/** A tool result replaced in the request, by its call. */
export type ShortenedResult = { callId: string; name: string };

/**
 * The stub that replaces an older tool result in a request.
 *
 * @param name - The model-facing tool name.
 */
export const shortenedResult = (name: string): string =>
	`Earlier result of \`${name}\` omitted to fit the context window; call the tool again if it is needed`;

/**
 * The characters a request sends: the system prompt, the tool definitions and the messages.
 *
 * @param sendsReasoning - Whether the provider sends assistant turns' reasoning back, so that it counts too.
 */
export const requestCharacters = (
	systemPrompt: string,
	tools: readonly ToolDefinition[],
	items: readonly ConversationItem[],
	sendsReasoning = false,
): number =>
	systemPrompt.length +
	JSON.stringify(tools).length +
	items.reduce((sum, item) => sum + sentCharacters(item, sendsReasoning), 0);

/**
 * Estimates a request's tokens, including the reply cap, which shares the window.
 *
 * @remarks
 * With a baseline, the previous turn's counted prompt plus the change in characters since; without one, every
 * character at the conservative ratio.
 */
export const estimateTokens = ({
	chars,
	baseline,
	charsPerToken,
	maxOutputTokens,
}: {
	chars: number;
	baseline: Baseline | undefined;
	charsPerToken: number;
	maxOutputTokens: number;
}): number =>
	(baseline
		? baseline.inputTokens + Math.ceil((chars - baseline.sentChars) / charsPerToken)
		: Math.ceil(chars / charsPerToken)) + maxOutputTokens;

/** A request's messages after fitting them to the window. */
export type Fitted = {
	items: ConversationItem[];
	chars: number;
	shortened: ShortenedResult[];
	estimateBefore: number;
	estimateAfter: number;
	fits: boolean;
};

/**
 * Fits a request's messages to the context window.
 *
 * @remarks
 * Only the request changes: the conversation keeps every result whole. The system prompt, user and assistant messages
 * and the latest turn's results are never shortened. The latest turn is named by its call ids, since a reply with
 * calls and no text leaves no message between one turn's results and the next.
 *
 * @returns The messages to send, what was shortened, and whether the request now fits.
 */
export const fitToWindow = ({
	systemPrompt,
	tools,
	items,
	latestCalls,
	window,
	sendsReasoning = false,
	baseline,
	maxOutputTokens,
}: {
	systemPrompt: string;
	tools: readonly ToolDefinition[];
	items: readonly ConversationItem[];
	/** The latest turn's call ids, whose results are never shortened. */
	latestCalls: ReadonlySet<string>;
	window: ContextWindowSettings;
	/** Whether the provider sends assistant turns' reasoning back, so that it counts too. */
	sendsReasoning?: boolean;
	baseline: Baseline | undefined;
	maxOutputTokens: number;
}): Fitted => {
	const charsPerToken = window.charsPerToken ?? DEFAULT_CHARS_PER_TOKEN;
	const estimate = (chars: number) => estimateTokens({ chars, baseline, charsPerToken, maxOutputTokens });

	const sent = [...items];
	let chars = requestCharacters(systemPrompt, tools, sent, sendsReasoning);
	const estimateBefore = estimate(chars);
	const shortened: ShortenedResult[] = [];

	if (estimateBefore > window.tokens && window.policy === 'shorten') {
		const names = new Map(items.filter(isFunctionCall).map(({ callId, name }) => [callId, name]));
		for (const [index, item] of items.entries()) {
			if (estimate(chars) <= window.tokens) {
				break;
			}
			if (!isFunctionCallOutput(item) || latestCalls.has(item.callId)) {
				continue;
			}
			const name = names.get(item.callId) ?? 'unknown';
			const stub = functionCallOutput(item.callId, shortenedResult(name), item.isError);
			chars += stub.output.length - item.output.length;
			sent[index] = stub;
			shortened.push({ callId: item.callId, name });
		}
	}

	const estimateAfter = estimate(chars);
	return { items: sent, chars, shortened, estimateBefore, estimateAfter, fits: estimateAfter <= window.tokens };
};

/**
 * The backstop: whether the server truncated the prompt anyway.
 *
 * @remarks
 * Applies only when the request grew and the same results were shortened as last turn, so a smaller count can only
 * mean the server dropped messages.
 */
export const serverTruncated = (
	baseline: Baseline | undefined,
	current: { inputTokens: number; sentChars: number; shortened: string[] },
): boolean =>
	baseline !== undefined &&
	current.sentChars > baseline.sentChars &&
	current.shortened.join('\0') === baseline.shortened.join('\0') &&
	current.inputTokens <= baseline.inputTokens;
