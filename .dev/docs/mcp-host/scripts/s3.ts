/**
 * Spike S3: does Ollama's `/v1/chat/completions` report exact usage at the end of a stream?
 *
 * For each model, the same request is sent streamed (with `stream_options.include_usage`) and not
 * streamed, once answering in text and once with the Arranger tools available.
 *
 * Run from the repository root (after `s2s5.ts` has written `results/tools.json`):
 *   npx tsx .dev/docs/mcp-host/scripts/s3.ts [--base-url <url>] [--models a,b]
 */
import { mkdir, writeFile } from 'node:fs/promises';

import { baseUrlFromArgs, chat, greedy, loadMcpTools, LOCAL_MODELS, modelsFromArgs, toOpenAiTools } from './ollama.ts';

const OUT = new URL('../results/s3/', import.meta.url);
await mkdir(OUT, { recursive: true });

const baseUrl = baseUrlFromArgs();
const models = modelsFromArgs(LOCAL_MODELS);
const tools = toOpenAiTools(await loadMcpTools());

const cases = {
	text: { messages: [{ role: 'user', content: 'In one sentence, what is a cohort study?' }] },
	tools: { messages: [{ role: 'user', content: 'Which data catalogues can I query?' }], tools },
};

type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
type Chunk = { choices?: { delta?: Record<string, unknown>; finish_reason?: string | null }[]; usage?: Usage };

const summary: Record<string, unknown>[] = [];

for (const model of models) {
	const raw: Record<string, unknown> = {};
	for (const [name, payload] of Object.entries(cases)) {
		const body = { model, ...payload, ...greedy, max_tokens: 2048 };
		const plain = await chat(baseUrl, body);
		const streamed = await chat(baseUrl, { ...body, stream: true, stream_options: { include_usage: true } });
		raw[name] = { plain, streamed };

		const plainBody =
			plain.kind === 'json'
				? (plain.body as {
						usage?: Usage;
						choices?: { finish_reason?: string; message?: Record<string, unknown> }[];
					})
				: undefined;
		const chunks = streamed.kind === 'stream' ? (streamed.chunks as Chunk[]) : [];
		const usageChunks = chunks.filter((chunk) => chunk.usage);
		const last = chunks.at(-1);
		summary.push({
			model,
			case: name,
			plainStatus: plain.status,
			plainUsage: plainBody?.usage,
			plainFinish: plainBody?.choices?.[0]?.finish_reason,
			plainMessageKeys: Object.keys(plainBody?.choices?.[0]?.message ?? {}),
			streamStatus: streamed.status,
			chunkCount: chunks.length,
			usageChunkCount: usageChunks.length,
			streamUsage: usageChunks.at(-1)?.usage,
			usageChunkIsLast: last?.usage !== undefined,
			usageChunkChoices: usageChunks.at(-1)?.choices,
			streamFinish: chunks.flatMap((chunk) => chunk.choices ?? []).find((choice) => choice.finish_reason)
				?.finish_reason,
			deltaKeys: [
				...new Set(
					chunks.flatMap((chunk) =>
						(chunk.choices ?? []).flatMap((choice) => Object.keys(choice.delta ?? {})),
					),
				),
			],
			sawDone: streamed.kind === 'stream' ? streamed.sawDone : undefined,
			usageMatches:
				plainBody?.usage?.prompt_tokens === usageChunks.at(-1)?.usage?.prompt_tokens &&
				plainBody?.usage?.completion_tokens === usageChunks.at(-1)?.usage?.completion_tokens,
		});
		console.log(JSON.stringify(summary.at(-1)));
	}
	await writeFile(new URL(`${model.replace(/[:/]/g, '_')}.json`, OUT), JSON.stringify(raw, null, '\t') + '\n');
}

await writeFile(new URL('summary.json', OUT), JSON.stringify(summary, null, '\t') + '\n');
