/**
 * Replays S4 responses that came back empty with `finish_reason: stop`, the signature of a tool call
 * the serving stack generated but did not return, to see whether they reproduce.
 *
 * Each request is resent exactly (same messages, tools, temperature and seed), once on `/v1` and once
 * on Ollama's native `/api/chat`, which reports the same parse but names the model's raw output in its
 * error when a parser refuses it. Watch the Ollama server's own output while this runs: a dropped
 * gemma4 call logs "gemma4 tool call parsing failed".
 *
 *   LOG_LEVEL=fatal npx tsx .dev/docs/mcp-host/scripts/replayEmpty.ts [--run s4]
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';

import { buildStages, startCatalogueServer } from './conversation.ts';
import { GOALS } from './goals.ts';
import { baseUrlFromArgs, chat, toOpenAiTools } from './ollama.ts';

const index = process.argv.indexOf('--run');
const run = index >= 0 ? process.argv[index + 1] : 's4';
const dir = new URL(`../results/${run}/`, import.meta.url);
const baseUrl = baseUrlFromArgs();
const root = baseUrl.replace(/\/v1\/?$/, '');

/** Native `/api/chat` takes tool-call arguments as objects, where `/v1` takes JSON strings. */
const toNative = (messages: Record<string, unknown>[]) =>
	messages.map((message) =>
		Array.isArray(message.tool_calls)
			? {
					...message,
					tool_calls: (message.tool_calls as { function: { name: string; arguments: string } }[]).map((call) => ({
						function: { name: call.function.name, arguments: JSON.parse(call.function.arguments) },
					})),
				}
			: message,
	);

type Line = { model: string; goal: string; step: number; temperature: number; seed: number; classification: string; finishReason?: string };

const server = await startCatalogueServer();
try {
	const stages = await buildStages(server, GOALS);
	const tools = toOpenAiTools(server.tools);
	const replays: Record<string, unknown>[] = [];
	for (const file of (await readdir(dir)).filter((entry) => entry.endsWith('.jsonl'))) {
		const lines = (await readFile(new URL(file, dir), 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line) as Line);
		for (const line of lines.filter((candidate) => candidate.classification === 'empty' && candidate.finishReason === 'stop')) {
			const stage = stages.find((candidate) => candidate.goal.id === line.goal && candidate.stepIndex === line.step);
			if (!stage) {
				continue;
			}
			const request = { model: line.model, messages: stage.messages, tools, temperature: line.temperature, top_p: 1, seed: line.seed, max_tokens: 4096 };
			const openai = await chat(baseUrl, request);
			const native = await fetch(`${root}/api/chat`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					model: line.model,
					messages: toNative(stage.messages),
					tools,
					stream: false,
					options: { temperature: line.temperature, top_p: 1, seed: line.seed, num_predict: 4096 },
				}),
			});
			const nativeBody = await native.json();
			const message = (openai.body as { choices?: { message?: Record<string, unknown>; finish_reason?: string }[]; usage?: unknown }).choices?.[0];
			const replay = {
				at: new Date().toISOString(),
				model: line.model,
				goal: line.goal,
				step: line.step,
				seed: line.seed,
				openai: {
					status: openai.status,
					finish: message?.finish_reason,
					content: message?.message?.content,
					toolCalls: message?.message?.tool_calls,
					usage: (openai.body as { usage?: unknown }).usage,
				},
				native: {
					status: native.status,
					content: nativeBody.message?.content,
					toolCalls: nativeBody.message?.tool_calls,
					evalCount: nativeBody.eval_count,
					error: nativeBody.error,
				},
			};
			replays.push(replay);
			console.log(JSON.stringify(replay));
		}
	}
	await writeFile(new URL('replay-empty.json', dir), JSON.stringify(replays, null, '\t') + '\n');
} finally {
	await server.close();
}
