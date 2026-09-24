import assert from 'node:assert/strict';
import { test } from 'node:test';

import { type Client } from '@modelcontextprotocol/client';

import { SERVER_INSTRUCTIONS } from '../../../apps/mcp-server/src/mcp/instructions.js';

export type SpinupEnv = {
	getClient: () => Client;
	configuredCatalogues: string[];
};

/**
 * Asserts that the MCP server started successfully and is reachable via the MCP protocol.
 *
 * Reaching this suite means `startMcpServerForTest` already validated the connection to Arranger
 * (`validateArrangerConnection` runs before `app.listen`). Anything here is a redundancy check
 * to confirm that the MCP transport is wired correctly and that the resources/tools registered
 * by the server are visible to a client.
 */
export default ({ getClient, configuredCatalogues }: SpinupEnv) => {
	// `ping` was removed by protocol revision 2026-07-28, and the SDK refuses it locally before it
	// reaches the wire. `server/discover` replaces it as the request every modern client makes at
	// connect, so it is the reachability probe now.
	test('1.responds to server/discover over the MCP transport', async () => {
		await assert.doesNotReject(getClient().discover());
	});

	test('2.reports server name and version after initialization', async () => {
		const info = getClient().getServerVersion();
		assert.ok(info, 'expected server version info to be populated after connect()');
		assert.equal(info?.name, 'arranger-mcp-server');
	});

	test('3.advertises resources, tools and prompts capabilities', async () => {
		const capabilities = getClient().getServerCapabilities();
		assert.ok(capabilities, 'expected server capabilities to be populated after connect()');
		assert.ok(capabilities?.resources, 'expected resources capability');
		assert.ok(capabilities?.tools, 'expected tools capability');
		assert.ok(capabilities?.prompts, 'expected prompts capability');
	});

	test('4.lists the three resources registered by the MCP server', async () => {
		const { resources } = await getClient().listResources();
		const uris = resources.map((resource) => resource.uri).sort();
		const expected = [
			'arranger://introspection/server',
			'arranger://introspection/sqon',
			...configuredCatalogues.map((id) => `arranger://introspection/catalog/${id}`),
		].sort();
		assert.deepEqual(uris, expected);
	});

	test('5.lists the five tools registered by the MCP server', async () => {
		const { tools } = await getClient().listTools();
		const names = tools.map((tool) => tool.name).sort();
		assert.deepEqual(names, [
			'build_sqon',
			'execute_query',
			'get_catalogue_fields',
			'get_sqon_schema',
			'list_catalogues',
		]);
	});

	test('6.lists the one prompt registered by the MCP server', async () => {
		const { prompts } = await getClient().listPrompts();
		const names = prompts.map((prompt) => prompt.name).sort();
		assert.deepEqual(names, ['query_arranger']);
	});

	test('7.delivers the server instructions verbatim in the initialize response', async () => {
		// Instructions are sent once, in the initialize result, and clients typically fold them into
		// the model's system prompt. Nothing else on the wire carries them, so if this is empty the
		// model reaches the tool list with no discovery-before-query rule at all.
		const instructions = getClient().getInstructions();
		assert.ok(instructions, 'expected server instructions to be populated after connect()');
		assert.equal(instructions, SERVER_INSTRUCTIONS);
	});

	test('8.states the never-guess rules and names the discovery tools in the instructions', async () => {
		// Asserting on content, not just delivery: rewording the prose is fine, dropping a rule or
		// the tool that satisfies it is the regression this guards against.
		const instructions = getClient().getInstructions() ?? '';

		assert.ok(instructions.includes('## Never guess'), 'expected a never-guess section');

		for (const toolName of ['list_catalogues', 'get_catalogue_fields', 'build_sqon', 'execute_query']) {
			assert.ok(instructions.includes(toolName), `expected the instructions to name ${toolName}`);
		}

		for (const rule of [
			'Never invent or guess a catalogue name.',
			'Never invent or guess a field name.',
			'Never write a SQON filter from memory.',
		]) {
			assert.ok(instructions.includes(rule), `expected the instructions to state: ${rule}`);
		}
	});
};
