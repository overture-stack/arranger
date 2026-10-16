/**
 * Spike S1, part one: which JSON Schema keywords in the Arranger tools reach the model?
 *
 * Ollama decodes `tools` into a fixed struct and never rejects a schema, so the question is what it
 * silently drops. For each tool and each keyword the tool uses, the request is sent once with the
 * schema as served and once with that keyword removed everywhere. Equal `prompt_tokens` means the
 * keyword never reached the prompt. `description` is the control: removing it must change the count.
 *
 * Generation is capped at one token, so each request costs a prompt evaluation only.
 *
 * Run from the repository root:
 *   npx tsx .dev/docs/mcp-host/scripts/s1Keywords.ts [--base-url <url>] [--models a,b]
 */
import { mkdir, writeFile } from 'node:fs/promises';

import {
	baseUrlFromArgs,
	chat,
	greedy,
	loadMcpTools,
	LOCAL_MODELS,
	type McpTool,
	modelsFromArgs,
	toOpenAiTools,
} from './ollama.ts';

const OUT = new URL('../results/s1/', import.meta.url);
await mkdir(OUT, { recursive: true });

/** Keys whose values are maps of names to schemas, so their own keys are names, not keywords. */
const NAME_MAPS = new Set(['properties', '$defs', 'patternProperties']);

const walk = (schema: unknown, visit: (node: Record<string, unknown>) => void): void => {
	if (Array.isArray(schema)) {
		schema.forEach((item) => walk(item, visit));
		return;
	}
	if (!schema || typeof schema !== 'object') {
		return;
	}
	const node = schema as Record<string, unknown>;
	visit(node);
	for (const [key, value] of Object.entries(node)) {
		if (NAME_MAPS.has(key) && value && typeof value === 'object') {
			Object.values(value).forEach((child) => walk(child, visit));
		} else {
			walk(value, visit);
		}
	}
};

const keywordsIn = (schema: unknown): string[] => {
	const found = new Set<string>();
	walk(schema, (node) => Object.keys(node).forEach((key) => found.add(key)));
	return [...found].sort();
};

/** A copy of the schema with one keyword removed wherever it appears as a keyword. */
const without = (schema: unknown, keyword: string): unknown => {
	const copy = structuredClone(schema);
	walk(copy, (node) => delete node[keyword]);
	return copy;
};

/**
 * `oneOf` replaced by its first branch, and by `anyOf` with the same branches: shows whether the
 * branches are lost because of the keyword or because of where they sit.
 */
const rewriteOneOf = (schema: unknown, as: 'anyOf' | 'firstBranch'): unknown => {
	const copy = structuredClone(schema);
	walk(copy, (node) => {
		if (Array.isArray(node.oneOf)) {
			const branches = node.oneOf as Record<string, unknown>[];
			delete node.oneOf;
			if (as === 'anyOf') {
				node.anyOf = branches;
			} else {
				Object.assign(node, branches[0]);
			}
		}
	});
	return copy;
};

const promptTokens = async (baseUrl: string, model: string, tool: McpTool, inputSchema: unknown) => {
	const response = await chat(baseUrl, {
		model,
		messages: [{ role: 'user', content: 'Hello.' }],
		tools: toOpenAiTools([{ ...tool, inputSchema: inputSchema as Record<string, unknown> }]),
		...greedy,
		max_tokens: 1,
	});
	const body = response.body as { usage?: { prompt_tokens?: number }; error?: unknown };
	return response.status === 200 ? body.usage?.prompt_tokens : { status: response.status, body };
};

const baseUrl = baseUrlFromArgs();
const models = modelsFromArgs(LOCAL_MODELS);
const tools = await loadMcpTools();
const rows: Record<string, unknown>[] = [];

for (const model of models) {
	for (const tool of tools) {
		const served = await promptTokens(baseUrl, model, tool, tool.inputSchema);
		const variants: Record<string, unknown> = {};
		for (const keyword of keywordsIn(tool.inputSchema)) {
			variants[`-${keyword}`] = await promptTokens(baseUrl, model, tool, without(tool.inputSchema, keyword));
		}
		if (JSON.stringify(tool.inputSchema).includes('"oneOf"')) {
			variants['oneOf->anyOf'] = await promptTokens(
				baseUrl,
				model,
				tool,
				rewriteOneOf(tool.inputSchema, 'anyOf'),
			);
			variants['oneOf->firstBranch'] = await promptTokens(
				baseUrl,
				model,
				tool,
				rewriteOneOf(tool.inputSchema, 'firstBranch'),
			);
		}
		const dropped = Object.entries(variants)
			.filter(([name, tokens]) => name.startsWith('-') && tokens === served)
			.map(([name]) => name.slice(1));
		rows.push({ model, tool: tool.name, served, variants, droppedKeywords: dropped });
		console.log(JSON.stringify(rows.at(-1)));
	}
}

await writeFile(new URL('keywords.json', OUT), JSON.stringify(rows, null, '\t') + '\n');
