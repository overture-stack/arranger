import { createHash } from 'node:crypto';

import { type SurfaceSnapshot, type Tool } from '@overture-stack/arranger-mcp-client';

/** The longest tool name OpenAI-style APIs accept. */
export const MAX_TOOL_NAME_LENGTH = 64;

const DISALLOWED = /[^a-zA-Z0-9_-]/g;
const HASH_SUFFIX_LENGTH = 8;

/**
 * The model-facing name of a server's tool: `mcp__<server>__<tool>`, reduced to `^[a-zA-Z0-9_-]{1,64}$`.
 *
 * @remarks
 * Each part has every other character replaced with `_`. A name still over 64 characters is cut, and ends with `_`
 * and 8 hex characters of a SHA-256 over the original server key and tool name, so the result is deterministic.
 * Reduction can map two tools to one name, which {@link buildRegistry} catches.
 *
 * @param server - The server's key.
 * @param tool - The tool's MCP name, which may contain `.` and run to 128 characters.
 * @returns The name to give the model.
 */
export const reduceToolName = (server: string, tool: string): string => {
	const name = `mcp__${server.replace(DISALLOWED, '_')}__${tool.replace(DISALLOWED, '_')}`;
	if (name.length <= MAX_TOOL_NAME_LENGTH) {
		return name;
	}
	const hash = createHash('sha256').update(`${server}\0${tool}`).digest('hex').slice(0, HASH_SUFFIX_LENGTH);
	return `${name.slice(0, MAX_TOOL_NAME_LENGTH - HASH_SUFFIX_LENGTH - 1)}_${hash}`;
};

/** A tool the model can call, and where it routes. */
export type RegisteredTool = { name: string; server: string; tool: Tool };

/** A tool the model is not offered, and why. */
export type LeftOutTool = { server: string; tool: string; name: string; reason: 'collision' };

/** The tools of every server, by model-facing name. */
export type ToolRegistry = {
	/** In server order, then each server's list order. */
	tools: RegisteredTool[];
	/** Routing reads this map, never the name's text. */
	byName: ReadonlyMap<string, RegisteredTool>;
	/** Tools whose reduced name collides with another's. */
	leftOut: LeftOutTool[];
};

/**
 * Builds the registry from each server's tools.
 *
 * @param servers - Each server's key and tool list, in configuration order.
 * @returns Every tool whose reduced name is unique. Tools sharing a name are all left out, since neither can be
 * routed to safely.
 */
export const buildRegistry = (servers: readonly { key: string; tools: readonly Tool[] }[]): ToolRegistry => {
	const candidates = servers.flatMap(({ key, tools }) =>
		tools.map((tool): RegisteredTool => ({ name: reduceToolName(key, tool.name), server: key, tool })),
	);
	const counts = new Map<string, number>();
	for (const { name } of candidates) {
		counts.set(name, (counts.get(name) ?? 0) + 1);
	}

	const tools = candidates.filter(({ name }) => counts.get(name) === 1);
	const leftOut = candidates
		.filter(({ name }) => counts.get(name) !== 1)
		.map(({ name, server, tool }): LeftOutTool => ({ server, tool: tool.name, name, reason: 'collision' }));

	return { tools, byName: new Map(tools.map((entry) => [entry.name, entry])), leftOut };
};

/** One tool as the model is offered it. The provider wraps it in its own request format. */
export type ToolDefinition = {
	name: string;
	description?: string;
	/** The tool's MCP `inputSchema`, unchanged. */
	parameters: Tool['inputSchema'];
};

/** What the model is given before any message: the system prompt and the tools. */
export type ModelSurface = { systemPrompt: string; tools: ToolDefinition[] };

/** A server as {@link toModelSurface} needs it. */
export type SurfaceServer = { key: string; trusted: boolean; snapshot: SurfaceSnapshot };

/**
 * The heading of a trusted server's instructions in the system prompt.
 *
 * @param key - The server's key.
 */
export const instructionsHeading = (key: string): string => `Instructions from server "${key}":`;

/**
 * The system prompt: the consumer's, then each trusted server's instructions under a heading. Untrusted servers'
 * instructions never enter it (MCP Host Plan §1, rule 5).
 */
const systemPromptOf = (systemPrompt: string | undefined, servers: readonly SurfaceServer[]): string =>
	[
		...(systemPrompt ? [systemPrompt] : []),
		...servers
			.filter(({ trusted, snapshot }) => trusted && snapshot.instructions)
			.map(({ key, snapshot }) => `${instructionsHeading(key)}\n${snapshot.instructions}`),
	].join('\n\n');

/**
 * A registered tool as the model is offered it.
 *
 * @param registered - The tool, under its model-facing name.
 * @returns Its name, description and unchanged input schema.
 */
export const toToolDefinition = ({ name, tool }: RegisteredTool): ToolDefinition => ({
	name,
	...(tool.description !== undefined && { description: tool.description }),
	parameters: tool.inputSchema,
});

/**
 * The model-facing surface, in host-core's neutral form, so `eval` can count its tokens.
 *
 * @remarks
 * Pure. Tools whose names collide are left out, as {@link buildRegistry} leaves them out.
 *
 * @param input - The consumer's system prompt, and each server's key, trust and surface snapshot.
 * @returns The system prompt and tool definitions a run would send.
 */
export const toModelSurface = ({
	systemPrompt,
	servers,
}: {
	systemPrompt?: string;
	servers: readonly SurfaceServer[];
}): ModelSurface => ({
	systemPrompt: systemPromptOf(systemPrompt, servers),
	tools: buildRegistry(servers.map(({ key, snapshot }) => ({ key, tools: snapshot.tools }))).tools.map(
		toToolDefinition,
	),
});
