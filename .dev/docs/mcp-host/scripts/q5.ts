/**
 * Open question 5: does sending a thinking model's `reasoning` back with its tool call change the next
 * call it makes?
 *
 * Turn 1 is one step of each goal, sampled: `build_sqon` by default, or the step `--from` names. When
 * it produces a valid call, that call runs against the real tool, and turn 2 (the goal's next step:
 * `execute_query` after `build_sqon`, `build_sqon` after `get_catalogue_fields`) is sent twice from
 * the same turn-1 output: once with the assistant message's `reasoning`, once without. Both turn-2
 * requests use the same seed, so the reasoning is the only difference. `prompt_tokens` for the two
 * shows whether the chat template renders it at all.
 *
 *   LOG_LEVEL=fatal npx tsx .dev/docs/mcp-host/scripts/q5.ts [--repeats 10] [--models a,b] [--goals id,id]
 *   LOG_LEVEL=fatal npx tsx .dev/docs/mcp-host/scripts/q5.ts --from get_catalogue_fields --hard --repeats 6
 *
 * `--hard` includes the hard goals. Results go to `results/q5/`, or `results/q5-<from>/` with `--from`.
 */
import { appendFile, mkdir, writeFile } from 'node:fs/promises';

import { buildStages, type Message, score, startCatalogueServer } from './conversation.ts';
import { GOALS } from './goals.ts';
import { assertContextLength, baseUrlFromArgs, chat, modelsFromArgs, toOpenAiTools } from './ollama.ts';

const option = (name: string) => {
	const index = process.argv.indexOf(`--${name}`);
	return index >= 0 ? process.argv[index + 1] : undefined;
};

const repeats = Number(option('repeats') ?? 10);
const from = option('from') ?? 'build_sqon';
const includeHard = process.argv.includes('--hard');
const goalIds = option('goals')?.split(',');
const baseUrl = baseUrlFromArgs();
const models = modelsFromArgs(['qwen3:14b', 'gemma4:e4b', 'gemma4:12b']);
const OUT = new URL(from === 'build_sqon' ? '../results/q5/' : `../results/q5-${from}/`, import.meta.url);
await mkdir(OUT, { recursive: true });

const server = await startCatalogueServer();
try {
	const goals = GOALS.filter((goal) => (includeHard || !goal.hard) && (!goalIds || goalIds.includes(goal.id)));
	const stages = (await buildStages(server, goals)).filter(
		(stage) => stage.expectedTool === from && stage.goal.steps[stage.stepIndex + 1],
	);
	const tools = toOpenAiTools(server.tools);
	const sample = { temperature: 0.7, top_p: 1, max_tokens: 4096 };

	for (const model of models) {
		await assertContextLength(baseUrl, model);
		const file = new URL(`${model.replace(/[:/]/g, '_')}.jsonl`, OUT);
		await writeFile(file, '');
		for (const stage of stages) {
			for (let repeat = 0; repeat < repeats; repeat++) {
				const seed = 1000 + repeat;
				const first = await chat(baseUrl, { model, messages: stage.messages, tools, seed, ...sample });
				const body = first.kind === 'json' ? (first.body as { choices?: { message?: Message }[] }) : undefined;
				const message = body?.choices?.[0]?.message;
				const call = (
					message?.tool_calls as { id: string; function: { name: string; arguments: string } }[] | undefined
				)?.[0];
				const line: Record<string, unknown> = { model, goal: stage.goal.id, seed, turn1Status: first.status };

				if (!message || !call || call.function.name !== from) {
					line.turn1 = `no ${from} call`;
					line.turn1Message = message;
				} else {
					let args: Record<string, unknown> | undefined;
					try {
						args = JSON.parse(call.function.arguments);
					} catch {
						line.turn1 = 'unparseable arguments';
					}
					const built = args ? await server.run({ name: from, arguments: args }) : undefined;
					if (built && built.outcome !== 'result') {
						line.turn1 = `${from} ${built.outcome}`;
						line.turn1Text = built.text.slice(0, 600);
					} else if (built) {
						const sqon =
							from === 'build_sqon'
								? (built.structured as { sqon?: unknown } | undefined)?.sqon
								: undefined;
						const toolMessage = { role: 'tool', tool_call_id: call.id, content: built.text };
						const turn1 = { reasoningChars: String(message.reasoning ?? '').length, args };
						const withoutReasoning = { ...message };
						delete withoutReasoning.reasoning;
						const conditions: Record<string, unknown> = {};
						for (const [condition, assistant] of [
							['with', message],
							['without', withoutReasoning],
						] as const) {
							const second = await chat(baseUrl, {
								model,
								messages: [...stage.messages, assistant, toolMessage],
								tools,
								seed,
								...sample,
							});
							const secondBody = second.kind === 'json' ? second.body : undefined;
							const nextStage = { ...stage, expectedTool: stage.goal.steps[stage.stepIndex + 1].name };
							const scored = await score(server, nextStage, second.status, secondBody, sqon);
							conditions[condition] = {
								promptTokens: (secondBody as { usage?: { prompt_tokens?: number } } | undefined)?.usage
									?.prompt_tokens,
								...scored,
								rawBody: secondBody,
							};
						}
						Object.assign(line, { turn1: 'ok', turn1Detail: turn1, conditions });
					}
				}
				await appendFile(file, JSON.stringify(line) + '\n');
				const conditions = line.conditions as Record<string, Record<string, unknown>> | undefined;
				console.log(
					JSON.stringify({
						model,
						goal: stage.goal.id,
						seed,
						turn1: line.turn1,
						...(conditions &&
							Object.fromEntries(
								Object.entries(conditions).map(([key, value]) => [
									key,
									[
										value.promptTokens,
										value.classification,
										value.rightTool,
										value.schemaValid,
										value.serverOutcome,
										value.sqonUnchanged ?? value.fieldsMatch,
									],
								]),
							)),
					}),
				);
			}
		}
	}
} finally {
	await server.close();
}
