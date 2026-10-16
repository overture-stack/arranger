/**
 * Conversations for the model-facing spikes (S1, S4, Q5), with tool results produced by the real tool
 * code running against the synthetic catalogue in `catalogue.ts`.
 *
 * A conversation is cut off just before the step under test: the model gets the system prompt (the
 * server's instructions, as a trusted server's would be), the user's goal, and the earlier tool calls
 * with their real results. The model's next call is then scored four ways: does it parse, is it the
 * expected tool, do its arguments match the tool's input schema, and does the server accept it.
 */
import {
	type CallToolResult,
	Client,
	fromJsonSchema,
	type InputRequiredResult,
	isInputRequiredResult,
	StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';

import { SERVER_INSTRUCTIONS } from '../../../../apps/mcp-server/src/mcp/instructions.ts';

import { catalogueIntrospections, loadSqonIntrospection, serverIntrospection } from './catalogue.ts';
import { type McpTool } from './ollama.ts';
import { startTestServer } from './testServer.ts';

export type ToolCall = { name: string; arguments: Record<string, unknown> };

/** A step the model has already taken: its call, and the server's real reply to it. */
type PriorStep = ToolCall;

export type Goal = {
	id: string;
	prompt: string;
	/** Reference calls for every step before the last, used to build the prefixes. */
	steps: PriorStep[];
	/** Field names a correct `build_sqon` call uses, in any order. */
	expectedFields: string[];
	/** Marks the deliberately hard goals added for S4. */
	hard?: boolean;
};

export type Stage = { goal: Goal; stepIndex: number; expectedTool: string; messages: Message[] };
export type Message = Record<string, unknown>;

export const startCatalogueServer = async () => {
	const server = await startTestServer({
		server: serverIntrospection,
		catalogues: catalogueIntrospections,
		sqon: await loadSqonIntrospection(),
	});
	const client = new Client(
		{ name: 'phase0-spike', version: '0.0.0' },
		{
			versionNegotiation: { mode: { pin: '2026-07-28' } },
			capabilities: { elicitation: { form: {} } },
			inputRequired: { autoFulfill: false },
		},
	);
	await client.connect(new StreamableHTTPClientTransport(new URL(server.url)));
	const tools = (await client.listTools()).tools.filter((tool) => tool.name !== 'slow_probe') as McpTool[];
	const validators = new Map(tools.map((tool) => [tool.name, fromJsonSchema(tool.inputSchema as never)]));

	/** Calls a tool as the host would, stopping at a confirmation rather than answering it. */
	const run = async (call: ToolCall) => {
		try {
			const result = (await client.request(
				{ method: 'tools/call', params: { name: call.name, arguments: call.arguments } },
				{ allowInputRequired: true },
			)) as CallToolResult | InputRequiredResult;
			if (isInputRequiredResult(result)) {
				return { outcome: 'input_required' as const, text: '' };
			}
			const text = (result.content ?? [])
				.map((part) => (part.type === 'text' ? part.text : `[${part.type}]`))
				.join('\n');
			return {
				outcome: result.isError ? ('tool_error' as const) : ('result' as const),
				text,
				structured: result.structuredContent,
			};
		} catch (error) {
			return { outcome: 'rejected' as const, text: error instanceof Error ? error.message : String(error) };
		}
	};

	const validate = async (call: ToolCall) => {
		const validator = validators.get(call.name);
		if (!validator) {
			return ['unknown tool'];
		}
		const checked = await validator['~standard'].validate(call.arguments);
		return 'issues' in checked && checked.issues ? checked.issues.map((issue) => issue.message) : [];
	};

	const close = async () => {
		await client.close();
		await server.close();
	};

	return { tools, run, validate, close };
};

type CatalogueServer = Awaited<ReturnType<typeof startCatalogueServer>>;

/** Stands in for the `sqon` the goal's own `build_sqon` step returned. */
export const BUILT_SQON = '$BUILT_SQON';

const withBuiltSqon = (step: ToolCall, built: unknown): ToolCall =>
	step.arguments.sqon === BUILT_SQON ? { ...step, arguments: { ...step.arguments, sqon: built } } : step;

/**
 * One stage per step of each goal: the conversation up to that step, with every earlier step's real
 * result. Tool results go back as their text content, which is what host-core sends the model.
 */
export const buildStages = async (server: CatalogueServer, goals: Goal[]): Promise<Stage[]> => {
	const stages: Stage[] = [];
	for (const goal of goals) {
		const messages: Message[] = [
			{ role: 'system', content: SERVER_INSTRUCTIONS },
			{ role: 'user', content: goal.prompt },
		];
		let built: unknown;
		for (const [stepIndex, reference] of goal.steps.entries()) {
			const step = withBuiltSqon(reference, built);
			stages.push({ goal, stepIndex, expectedTool: step.name, messages: structuredClone(messages) });
			const id = `call_${goal.id}_${stepIndex}`;
			const result = await server.run(step);
			if (step.name === 'build_sqon') {
				built = (result.structured as { sqon?: unknown } | undefined)?.sqon;
			}
			if (result.outcome !== 'result' && result.outcome !== 'input_required') {
				throw new Error(
					`Reference step ${goal.id}/${stepIndex} (${step.name}) failed: ${result.outcome} ${result.text}`,
				);
			}
			messages.push(
				{
					role: 'assistant',
					content: '',
					tool_calls: [
						{
							id,
							type: 'function',
							function: { name: step.name, arguments: JSON.stringify(step.arguments) },
						},
					],
				},
				{ role: 'tool', tool_call_id: id, content: result.text },
			);
		}
	}
	return stages;
};

/** The `sqon` a goal's reference `build_sqon` step produced, for checking it is passed on unchanged. */
export const referenceSqon = async (server: CatalogueServer, goal: Goal) => {
	const build = goal.steps.find((step) => step.name === 'build_sqon');
	if (!build) {
		return undefined;
	}
	const result = await server.run(build);
	return (result.structured as { sqon?: unknown } | undefined)?.sqon;
};

type ChoiceMessage = {
	content?: string | null;
	reasoning?: string;
	tool_calls?: { function: { name: string; arguments: string } }[];
};

export type Classification =
	| 'tool_call'
	| 'unparseable_arguments'
	| 'text_only'
	| 'empty'
	| 'call_as_prose'
	| 'http_error';

/**
 * JSON with object keys sorted, for comparing values regardless of key order. Ollama re-encodes tool
 * arguments from a Go map, which sorts keys, so the arguments a host receives never keep the model's
 * own key order.
 */
export const canonicalJson = (value: unknown): string =>
	JSON.stringify(value, (_key, inner) =>
		inner && typeof inner === 'object' && !Array.isArray(inner)
			? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
			: inner,
	);

/** Whether a `build_sqon` call's clauses use exactly the goal's expected fields. */
export const fieldsMatch = (args: Record<string, unknown>, expected: string[]) =>
	[...new Set(((args.clauses as { fieldName?: string }[] | undefined) ?? []).map((clause) => clause.fieldName))]
		.sort()
		.join() === [...new Set(expected)].sort().join();

/** Anything in `content` that looks like a tool call the parser did not turn into one. */
const looksLikeCall = (text: string, toolNames: string[]) =>
	/<tool_call>|<\|tool_call|"name"\s*:|```json|\[TOOL_CALLS\]/.test(text) ||
	toolNames.some((name) => text.includes(`${name}(`));

/**
 * Scores one model response. `status` and `body` are the raw HTTP result, so an HTTP error is
 * classified here too, with its body kept as the evidence.
 */
export const score = async (server: CatalogueServer, stage: Stage, status: number, body: unknown, sqon?: unknown) => {
	if (status !== 200) {
		return { classification: 'http_error' as Classification, status, error: body };
	}
	const choice = (body as { choices?: { message?: ChoiceMessage; finish_reason?: string }[] }).choices?.[0];
	const message = choice?.message ?? {};
	const content = message.content ?? '';
	const base = {
		finishReason: choice?.finish_reason,
		contentChars: content.length,
		reasoningChars: message.reasoning?.length ?? 0,
	};
	const calls = message.tool_calls ?? [];
	if (calls.length === 0) {
		const toolNames = server.tools.map((tool) => tool.name);
		const classification: Classification = !content.trim()
			? 'empty'
			: looksLikeCall(content, toolNames)
				? 'call_as_prose'
				: 'text_only';
		return { classification, ...base, content: content.slice(0, 2000) };
	}

	const first = calls[0].function;
	let args: Record<string, unknown>;
	try {
		args = JSON.parse(first.arguments || '{}');
	} catch {
		return { classification: 'unparseable_arguments' as Classification, ...base, raw: first.arguments };
	}
	const call = { name: first.name, arguments: args };
	const schemaIssues = await server.validate(call);
	const served = await server.run(call);
	return {
		classification: 'tool_call' as Classification,
		...base,
		callCount: calls.length,
		call,
		rightTool: first.name === stage.expectedTool,
		schemaValid: schemaIssues.length === 0,
		schemaIssues,
		serverOutcome: served.outcome,
		serverText: served.outcome === 'result' ? undefined : served.text.slice(0, 600),
		...(first.name === 'build_sqon' ? { fieldsMatch: fieldsMatch(args, stage.goal.expectedFields) } : {}),
		...(first.name === 'execute_query' && sqon !== undefined
			? {
					sqonUnchanged: canonicalJson(args.sqon) === canonicalJson(sqon),
					sqonByteIdentical: JSON.stringify(args.sqon) === JSON.stringify(sqon),
				}
			: {}),
	};
};
