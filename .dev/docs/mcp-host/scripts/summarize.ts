/**
 * Summarizes a `runStages.ts` run into per-model counts, as Markdown on stdout.
 *
 * Field and `sqon` checks are recomputed here from the stored calls against the current goals, so a
 * correction to a goal or a check applies to runs already recorded.
 *
 *   npx tsx .dev/docs/mcp-host/scripts/summarize.ts s1-calls
 */
import { readdir, readFile } from 'node:fs/promises';

import { canonicalJson, fieldsMatch, referenceSqon, startCatalogueServer } from './conversation.ts';
import { GOALS } from './goals.ts';

const name = process.argv[2] ?? 's1-calls';
const dir = new URL(`../results/${name}/`, import.meta.url);

type Line = {
	model: string;
	goal: string;
	hard: boolean;
	step: number;
	expectedTool: string;
	classification: string;
	rightTool?: boolean;
	schemaValid?: boolean;
	serverOutcome?: string;
	fieldsMatch?: boolean;
	sqonUnchanged?: boolean;
	status?: number;
	call?: { name: string; arguments: Record<string, unknown> };
	durationMs: number;
};

const rows: string[] = [
	'| Model | Tool expected | n | Tool call | Right tool | Schema-valid | Server accepted | Fields match | `sqon` unchanged | Other outcomes |',
	'| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
];
const failures: string[] = [];

const server = await startCatalogueServer();
const sqons = new Map(
	await Promise.all(GOALS.map(async (goal) => [goal.id, canonicalJson(await referenceSqon(server, goal))] as const)),
);
await server.close();
const recheck = (line: Line): Line => {
	const goal = GOALS.find((candidate) => candidate.id === line.goal);
	if (!goal || !line.call) {
		return line;
	}
	return {
		...line,
		...(line.call.name === 'build_sqon'
			? { fieldsMatch: fieldsMatch(line.call.arguments, goal.expectedFields) }
			: {}),
		...(line.call.name === 'execute_query'
			? { sqonUnchanged: canonicalJson(line.call.arguments.sqon) === sqons.get(goal.id) }
			: {}),
	};
};

for (const file of (await readdir(dir)).filter((entry) => entry.endsWith('.jsonl')).sort()) {
	const lines = (await readFile(new URL(file, dir), 'utf8'))
		.split('\n')
		.filter(Boolean)
		.map((line) => recheck(JSON.parse(line) as Line));
	const byTool = Map.groupBy(lines, (line) => line.expectedTool);
	for (const [tool, group] of byTool) {
		const count = (predicate: (line: Line) => boolean | undefined) => group.filter(predicate).length;
		const calls = group.filter((line) => line.classification === 'tool_call');
		const others = Object.entries(
			Object.groupBy(
				group.filter((line) => line.classification !== 'tool_call'),
				(line) => line.classification,
			),
		)
			.map(([kind, items]) => `${kind} ${items?.length}`)
			.join(', ');
		const accepted = (line: Line) => line.serverOutcome === 'result' || line.serverOutcome === 'input_required';
		rows.push(
			`| ${group[0].model} | ${tool} | ${group.length} | ${calls.length} | ${count((line) => line.rightTool)} | ${count((line) => line.schemaValid)} | ${count((line) => line.rightTool && accepted(line))} | ${tool === 'build_sqon' ? count((line) => line.fieldsMatch) : ''} | ${tool === 'execute_query' ? count((line) => line.sqonUnchanged) : ''} | ${others} |`,
		);
		for (const line of group) {
			if (line.classification !== 'tool_call' || !line.rightTool || !line.schemaValid || !accepted(line)) {
				failures.push(
					`- ${line.model} ${line.goal} step ${line.step} (${tool}): ${line.classification}${line.call ? ` called ${line.call.name}` : ''}${line.schemaValid === false ? ', schema-invalid' : ''}${line.serverOutcome && !accepted(line) ? `, server ${line.serverOutcome}` : ''}`,
				);
			}
		}
	}
}

console.log(rows.join('\n'));
console.log(`\nNot a correct, accepted call (${failures.length}):\n${failures.join('\n')}`);
