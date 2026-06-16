import assert from 'node:assert';
import { test } from 'node:test';

import { type Client } from '@modelcontextprotocol/sdk/client';

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
	test('1.responds to a ping over the MCP transport', async () => {
		await assert.doesNotReject(getClient().ping());
	});

	test('2.reports server name and version after initialization', async () => {
		const info = getClient().getServerVersion();
		assert.ok(info, 'expected server version info to be populated after connect()');
		assert.equal(info?.name, 'arranger-mcp-server');
	});

	test('3.advertises resources and tools capabilities', async () => {
		const capabilities = getClient().getServerCapabilities();
		assert.ok(capabilities, 'expected server capabilities to be populated after connect()');
		assert.ok(capabilities?.resources, 'expected resources capability');
		assert.ok(capabilities?.tools, 'expected tools capability');
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

	test('5.lists the three tools registered by the MCP server', async () => {
		const { tools } = await getClient().listTools();
		const names = tools.map((tool) => tool.name).sort();
		assert.deepEqual(names, ['get-catalogue-fields', 'get-sqon-schema', 'list-catalogues']);
	});
};
