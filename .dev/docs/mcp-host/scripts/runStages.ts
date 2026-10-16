/**
 * Sends each goal's stages to each model and scores the next call. Shared by S1 and S4.
 *
 *   S1, greedy, once each:
 *     LOG_LEVEL=fatal npx tsx .dev/docs/mcp-host/scripts/runStages.ts --name s1-calls
 *   S4, sampled, repeated, argument-heavy steps only:
 *     LOG_LEVEL=fatal npx tsx .dev/docs/mcp-host/scripts/runStages.ts --name s4 --temperature 0.7 --repeats 5 --tools build_sqon,execute_query
 *
 * Options: --base-url, --models a,b, --goals id,id, --tools name,name, --temperature, --repeats.
 * Each repeat uses a different seed, so sampled repeats differ. Writes one JSONL line per response
 * under `results/<name>/`, including the raw HTTP body.
 */
import { appendFile, mkdir, writeFile } from 'node:fs/promises';

import { buildStages, referenceSqon, score, startCatalogueServer } from './conversation.ts';
import { GOALS } from './goals.ts';
import { assertContextLength, baseUrlFromArgs, chat, LOCAL_MODELS, modelsFromArgs, toOpenAiTools } from './ollama.ts';

const option = (name: string) => {
	const index = process.argv.indexOf(`--${name}`);
	return index >= 0 ? process.argv[index + 1] : undefined;
};

const name = option('name') ?? 's1-calls';
const temperature = Number(option('temperature') ?? 0);
const repeats = Number(option('repeats') ?? 1);
const goalIds = option('goals')?.split(',');
const toolFilter = option('tools')?.split(',');
const baseUrl = baseUrlFromArgs();
const models = modelsFromArgs(LOCAL_MODELS);

const OUT = new URL(`../results/${name}/`, import.meta.url);
await mkdir(OUT, { recursive: true });

const server = await startCatalogueServer();
try {
	const goals = GOALS.filter((goal) => !goalIds || goalIds.includes(goal.id));
	const stages = (await buildStages(server, goals)).filter(
		(stage) => !toolFilter || toolFilter.includes(stage.expectedTool),
	);
	const sqons = new Map(
		await Promise.all(goals.map(async (goal) => [goal.id, await referenceSqon(server, goal)] as const)),
	);
	const tools = toOpenAiTools(server.tools);
	await writeFile(
		new URL('run.json', OUT),
		JSON.stringify({ models, temperature, repeats, stages: stages.length, baseUrl }, null, '\t') + '\n',
	);

	for (const model of models) {
		await assertContextLength(baseUrl, model);
		const file = new URL(`${model.replace(/[:/]/g, '_')}.jsonl`, OUT);
		await writeFile(file, '');
		for (const stage of stages) {
			for (let repeat = 0; repeat < repeats; repeat++) {
				const seed = 42 + repeat;
				const response = await chat(baseUrl, {
					model,
					messages: stage.messages,
					tools,
					temperature,
					top_p: 1,
					seed,
					max_tokens: 4096,
				});
				const body = response.kind === 'json' ? response.body : undefined;
				const scored = await score(server, stage, response.status, body, sqons.get(stage.goal.id));
				const line = {
					model,
					goal: stage.goal.id,
					hard: stage.goal.hard ?? false,
					step: stage.stepIndex,
					expectedTool: stage.expectedTool,
					temperature,
					seed,
					durationMs: response.durationMs,
					usage: (body as { usage?: unknown } | undefined)?.usage,
					...scored,
					rawBody: body,
				};
				await appendFile(file, JSON.stringify(line) + '\n');
				const { rawBody: _raw, ...brief } = line;
				console.log(JSON.stringify({ ...brief, call: undefined, content: undefined }));
			}
		}
	}
} finally {
	await server.close();
}
