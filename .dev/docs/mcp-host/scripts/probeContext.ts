/**
 * Does each model's prompt hold the whole tool-calling history, and what does a tool result cost?
 *
 * Two probes, both with generation capped at one token so `prompt_tokens` is all that is measured:
 *
 * 1. History: each prefix of one goal's conversation in turn. Every added message should raise the
 *    count; one that does not never reached the prompt. Variants add the tool's `name` to tool
 *    messages and drop the empty `content` from assistant tool-call messages, in case a template
 *    needs either. Run below a large enough context, this is what showed silent truncation.
 * 2. Tool content: one fixed history with the last tool message's content varied (as served,
 *    minified, plain text), which measures what pretty-printing a result costs.
 *
 *   LOG_LEVEL=fatal npx tsx .dev/docs/mcp-host/scripts/probeContext.ts [--models a,b] [--goal id]
 */
import { mkdir, writeFile } from 'node:fs/promises';

import { buildStages, type Message, startCatalogueServer } from './conversation.ts';
import { GOALS } from './goals.ts';
import { baseUrlFromArgs, chat, greedy, LOCAL_MODELS, modelsFromArgs, toOpenAiTools } from './ollama.ts';

const index = process.argv.indexOf('--goal');
const goalId = index >= 0 ? process.argv[index + 1] : 'female-over-60';
const baseUrl = baseUrlFromArgs();
const models = modelsFromArgs(LOCAL_MODELS);
const OUT = new URL('../results/context/', import.meta.url);
await mkdir(OUT, { recursive: true });

/** Tool messages carry the called tool's name, as some templates expect. */
const withToolNames = (messages: Message[]) => {
	const names = new Map<string, string>();
	return messages.map((message) => {
		for (const call of (message.tool_calls as { id: string; function: { name: string } }[] | undefined) ?? []) {
			names.set(call.id, call.function.name);
		}
		return message.role === 'tool' ? { ...message, name: names.get(message.tool_call_id as string) } : message;
	});
};

/** Assistant tool-call messages with no `content` key at all, rather than an empty string. */
const withoutEmptyContent = (messages: Message[]) =>
	messages.map((message) => {
		if (message.role !== 'assistant' || message.content !== '') {
			return message;
		}
		const { content: _content, ...rest } = message;
		return rest;
	});

const server = await startCatalogueServer();
try {
	const goal = GOALS.find((candidate) => candidate.id === goalId);
	if (!goal) {
		throw new Error(`No goal "${goalId}"`);
	}
	const stages = await buildStages(server, [goal]);
	const tools = toOpenAiTools(server.tools);
	const promptTokens = async (model: string, messages: Message[]) => {
		const response = await chat(baseUrl, { model, messages, tools, ...greedy, max_tokens: 1 });
		const usage = (response.body as { usage?: { prompt_tokens?: number } } | undefined)?.usage;
		return response.status === 200 ? (usage?.prompt_tokens ?? '?') : `HTTP ${response.status}`;
	};

	// Probe 1: history prefixes.
	const full = stages.at(-1)?.messages ?? [];
	const roles = full.map((message) => message.role);
	const history: Record<string, unknown>[] = [];
	for (const model of models) {
		for (const [variant, transform] of [
			['as sent', (messages: Message[]) => messages],
			['tool names', withToolNames],
			['no empty content', withoutEmptyContent],
		] as const) {
			const counts: (number | string)[] = [];
			for (let length = 2; length <= full.length; length++) {
				counts.push(await promptTokens(model, transform(full.slice(0, length))));
			}
			const notRendered = counts
				.map((count, position) =>
					position > 0 && typeof count === 'number' && count <= (counts[position - 1] as number)
						? `${roles[position + 1]}@${position + 2}`
						: undefined,
				)
				.filter(Boolean);
			history.push({ model, variant, counts, notRendered });
			console.log(JSON.stringify(history.at(-1)));
		}
	}
	await writeFile(new URL('history.json', OUT), JSON.stringify({ goal: goalId, roles, history }, null, '\t') + '\n');

	// Probe 2: the last tool message's content, varied.
	const before = stages.find((stage) => stage.expectedTool === 'build_sqon')?.messages ?? [];
	const prefix = before.slice(0, -1);
	const last = before.at(-1) ?? {};
	const original = String(last.content);
	const variants: Record<string, string | undefined> = {
		'none (prefix only)': undefined,
		'pretty JSON (as served)': original,
		'minified JSON': JSON.stringify(JSON.parse(original)),
		'JSON after a text line': `Catalogue fields:\n${original}`,
		'plain text, same length': 'x '.repeat(original.length / 2),
	};
	const content: Record<string, unknown>[] = [];
	for (const model of models) {
		const counts: Record<string, unknown> = {};
		for (const [name, text] of Object.entries(variants)) {
			counts[name] = await promptTokens(
				model,
				text === undefined ? prefix : [...prefix, { ...last, content: text }],
			);
		}
		content.push({ model, originalChars: original.length, counts });
		console.log(JSON.stringify(content.at(-1)));
	}
	await writeFile(new URL('tool-content.json', OUT), JSON.stringify(content, null, '\t') + '\n');
} finally {
	await server.close();
}
