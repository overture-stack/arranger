import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { type ZodType } from 'zod';

import { type ArrangerClient } from '#arranger/client.js';
import { SERVER_INSTRUCTIONS } from '#mcp/instructions.js';
import { registerPrompts } from '#mcp/prompts.js';
import { SQON_CHEAT_SHEET } from '#mcp/sqonCheatSheet.js';
import { registerTools } from '#mcp/tools.js';
import { type ArrangerMcpConfig } from '#utils/config.js';

const config: ArrangerMcpConfig = {
	arrangerBaseUrl: 'https://arranger.test',
	catalogues: ['participants'],
	requestTimeoutMs: 10_000,
	mcp: { host: '0.0.0.0', port: 3100, path: '/mcp' },
};

const serverIntrospection = {
	catalogCount: 1,
	catalogs: {
		participants: {
			documentType: 'participant',
			paths: { fields: '/fields', graphql: '/graphql', introspection: '/introspection/participants' },
		},
	},
	mode: 'single',
	sqonSchemaPath: '/introspection/sqon',
};

const client = {
	getServerIntrospection: () => Promise.resolve(serverIntrospection),
} as unknown as ArrangerClient;

type RegisteredTool = {
	name: string;
	// Not `ZodRawShape`: on Zod 4 its values are the core `$ZodType`, which has no `.description`.
	config: { description?: string; inputSchema?: Record<string, ZodType>; title?: string };
};

const registerAllTools = (): RegisteredTool[] => {
	const tools: RegisteredTool[] = [];
	const server = {
		registerTool: (name: string, toolConfig: unknown) => {
			tools.push({ name, config: toolConfig } as RegisteredTool);
		},
	};
	registerTools(server as unknown as McpServer, { client, config });
	return tools;
};

const renderQueryArrangerPrompt = async (): Promise<string> => {
	const prompts: { name: string; callback: (args: { goal: string }) => Promise<{ messages: unknown[] }> }[] = [];
	const server = {
		registerPrompt: (name: string, _promptConfig: unknown, callback: unknown) => {
			prompts.push({ name, callback } as (typeof prompts)[number]);
		},
	};
	registerPrompts(server as unknown as McpServer, { client, config });

	const prompt = prompts[0];
	if (!prompt) {
		throw new Error('registerPrompts registered no prompt');
	}
	const { messages } = await prompt.callback({ goal: 'find male participants' });
	return messages.map((message) => (message as { content: { text: string } }).content.text).join('\n');
};

/**
 * Every tool this server exposes is named `<verb>_<subject>`, so any such identifier appearing in
 * prose is a tool reference. Matching the shape rather than a hard-coded list is what catches a
 * misspelled name: an allowlist would only ever confirm the names already written down.
 */
const TOOL_REFERENCE_PATTERN = /\b(?:build|get|list|execute)_[a-z0-9_]+\b/g;

const toolReferencesIn = (text: string): string[] => [...new Set(text.match(TOOL_REFERENCE_PATTERN) ?? [])];

suite('registerTools', () => {
	test('registers every tool the documented workflow depends on', () => {
		const names = registerAllTools().map(({ name }) => name);
		assert.deepEqual(names.sort(), [
			'build_sqon',
			'execute_query',
			'get_catalogue_fields',
			'get_sqon_schema',
			'list_catalogues',
		]);
	});

	test('registers each tool exactly once', () => {
		const names = registerAllTools().map(({ name }) => name);
		assert.equal(new Set(names).size, names.length);
	});
});

suite('execute_query guidance', () => {
	const executeQuery = () => {
		const tool = registerAllTools().find(({ name }) => name === 'execute_query');
		if (!tool) {
			throw new Error('execute_query was not registered');
		}
		return tool;
	};

	test('routes SQON construction through build_sqon rather than the cheat sheet', () => {
		const description = executeQuery().config.description ?? '';
		assert.ok(description.includes('build_sqon'));
		assert.ok(!description.includes('get_sqon_schema'));
	});

	test('tells the caller where the sqon argument comes from', () => {
		const sqon = executeQuery().config.inputSchema?.sqon;
		assert.ok(sqon?.description?.includes('build_sqon'));
	});
});

suite('tool references in text surfaces', () => {
	/**
	 * A tool name is a literal string in prose: nothing links it to the registration, so a typo is
	 * only ever caught by the model failing to call the tool at runtime.
	 */
	const assertAllReferencesResolve = (surface: string, text: string) => {
		const registered = new Set(registerAllTools().map(({ name }) => name));
		for (const reference of toolReferencesIn(text)) {
			assert.ok(registered.has(reference), `${surface} references a tool that is not registered: ${reference}`);
		}
	};

	test('server instructions name only registered tools', () => {
		assertAllReferencesResolve('SERVER_INSTRUCTIONS', SERVER_INSTRUCTIONS);
	});

	test('the SQON cheat sheet names only registered tools', () => {
		assertAllReferencesResolve('SQON_CHEAT_SHEET', SQON_CHEAT_SHEET);
	});

	test('tool descriptions name only registered tools', () => {
		for (const tool of registerAllTools()) {
			assertAllReferencesResolve(`${tool.name} description`, tool.config.description ?? '');
		}
	});

	test('tool input schema descriptions name only registered tools', () => {
		for (const tool of registerAllTools()) {
			const descriptions = Object.values(tool.config.inputSchema ?? {})
				.map((field) => field.description ?? '')
				.join('\n');
			assertAllReferencesResolve(`${tool.name} input schema`, descriptions);
		}
	});

	test('the query_arranger prompt names only registered tools', async () => {
		assertAllReferencesResolve('query_arranger prompt', await renderQueryArrangerPrompt());
	});
});

suite('query_arranger prompt', () => {
	test('walks the researcher through build_sqon before execute_query', async () => {
		const prompt = await renderQueryArrangerPrompt();
		assert.ok(prompt.indexOf('build_sqon') < prompt.indexOf('execute_query'));
	});

	test('no longer carries the SQON cheat sheet inline, now that build_sqon writes the filter', async () => {
		const prompt = await renderQueryArrangerPrompt();
		assert.ok(!prompt.includes(SQON_CHEAT_SHEET));
	});
});

suite('SERVER_INSTRUCTIONS', () => {
	test('walks the four tools of the workflow in call order', () => {
		const order = ['list_catalogues', 'get_catalogue_fields', 'build_sqon', 'execute_query'].map((tool) =>
			SERVER_INSTRUCTIONS.indexOf(tool),
		);
		assert.ok(order.every((position) => position >= 0));
		assert.deepEqual(
			[...order].sort((a, b) => a - b),
			order,
		);
	});

	test('forbids writing a SQON from memory', () => {
		assert.ok(SERVER_INSTRUCTIONS.includes('Never write a SQON filter from memory'));
	});
});
