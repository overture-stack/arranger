import { after, before, suite } from 'node:test';
import path from 'path';

import { type Client } from '@modelcontextprotocol/client';
import { stringToNumber } from '@overture-stack/arranger-types/tools';
import dotenv from 'dotenv';

import ArrangerServer from '../../../apps/search-server/src/server.js';
import { buildSearchClient } from '../../../modules/graphql-router/src/index.js';
import catalogueABase from '../multiconfigs/catalogue-a/base.json' with { type: 'json' };
import catalogueBBase from '../multiconfigs/catalogue-b/base.json' with { type: 'json' };

import catalogueAData from './assets/catalogue_a.data.json' with { type: 'json' };
import catalogueAMappings from './assets/catalogue_a.mappings.json' with { type: 'json' };
import catalogueBData from './assets/catalogue_b.data.json' with { type: 'json' };
import catalogueBMappings from './assets/catalogue_b.mappings.json' with { type: 'json' };
import buildSqon from './buildSqon.js';
import executeQuery from './executeQuery.js';
import { connectMcpClient } from './mcpClient.js';
import readPrompts from './readPrompts.js';
import readResources from './readResources.js';
import readTools from './readTools.js';
import spinupActive from './spinupActive.js';
import { startMcpServerForTest, type StartedMcpServer } from './startMcpServer.js';

dotenv.config({ path: path.resolve('../../.env.test') });

const esHost = process.env.ES_HOST || 'http://127.0.0.1:9200';
const esPass = process.env.ES_PASS;
const esUser = process.env.ES_USER;
const setsIndex = process.env.ES_ARRANGER_SETS_INDEX || 'arranger-sets-mcp-testing';
const setsType = process.env.ES_ARRANGER_SETS_TYPE || 'arranger-sets-mcp-testing';
const searchEngine = process.env.SEARCH_ENGINE || 'elasticsearch';
const arrangerPort = stringToNumber(process.env.SERVER_PORT, 5678);
const mcpPort = stringToNumber(process.env.MCP_TEST_PORT, 3199);

const arrangerBaseUrl = `http://127.0.0.1:${arrangerPort}`;

/**
 * Expands a catalogue's configured field names into the full set introspection reports. A config
 * lists only leaves, but Arranger also reports a container entry for every parent of a dotted path
 * (`donor-info` alongside `donor-info.age-at-diagnosis`), so deriving them here keeps the expected
 * field lists in step with the configs rather than hardcoding the containers.
 */
const withContainerFields = (fieldNames: string[]): string[] => [
	...new Set(
		fieldNames.flatMap((fieldName) => {
			const segments = fieldName.split('.');
			return segments.map((_, index) => segments.slice(0, index + 1).join('.'));
		}),
	),
];

const catalogueConfigs = [
	{
		catalogId: catalogueABase.catalogId,
		documentType: catalogueABase.documentType,
		esIndex: catalogueABase.esIndex,
		mappings: catalogueAMappings,
		data: catalogueAData,
		extendedFieldNames: withContainerFields(catalogueABase.extended.map((field) => field.fieldName)),
	},
	{
		catalogId: catalogueBBase.catalogId,
		documentType: catalogueBBase.documentType,
		esIndex: catalogueBBase.esIndex,
		mappings: catalogueBMappings,
		data: catalogueBData,
		extendedFieldNames: withContainerFields(catalogueBBase.extended.map((field) => field.fieldName)),
	},
];

const configuredCatalogues = catalogueConfigs.map((c) => c.catalogId);
const expectedDocumentTypes = Object.fromEntries(catalogueConfigs.map((c) => [c.catalogId, c.documentType]));
const expectedFieldsByCatalogue = Object.fromEntries(catalogueConfigs.map((c) => [c.catalogId, c.extendedFieldNames]));

const useESAuth = !!esPass && !!esUser;
const esClient = await buildSearchClient({
	client: searchEngine,
	node: esHost,
	...(useESAuth && {
		username: esUser,
		password: esPass,
	}),
});

const cleanupIndices = async () => {
	const allTestIndices = [...catalogueConfigs.map((c) => c.esIndex), setsIndex];
	const uniqueIndices = [...new Set(allTestIndices)];

	const deletePromises = uniqueIndices.map(async (index) => {
		try {
			await esClient.indices.delete({ index });
		} catch (err: any) {
			if (err?.meta?.body?.error?.type !== 'index_not_found_exception') {
				console.warn(`Warning: Could not delete index ${index}:`, err.message);
			}
		}
	});

	await Promise.all(deletePromises);
};

// Test runtime context: populated by the `before` hook below, consumed by tests via `getClient()`/`getServerUrl()`.
// Defined here to avoid issues with test isolation and variable scope across the `before` hook and individual tests.
const context: { mcpClient?: Client; mcpServerUrl?: string } = {};
const getClient = () => {
	if (!context.mcpClient) {
		throw new Error('MCP client has not been initialized: `before` hook did not run successfully');
	}
	return context.mcpClient;
};
const getServerUrl = () => {
	if (!context.mcpServerUrl) {
		throw new Error('MCP server URL has not been set: `before` hook did not run successfully');
	}
	return context.mcpServerUrl;
};

suite('integration-tests/mcp-server', { concurrency: false }, () => {
	let arrangerApp: Awaited<ReturnType<typeof ArrangerServer>> | undefined;
	let mcpServer: StartedMcpServer | undefined;

	// Does the following before tests run:
	// - 1. Cleans up any existing test indices
	// - 2. Initializes test indices with mappings for the test suite
	// - 3. Starts an Arranger server in multicatalogue mode
	// - 4. Starts the MCP server
	// - 5. Connects an MCP client to the MCP server and stores it in `context` for tests to use
	before(async () => {
		try {
			await cleanupIndices();
		} catch {
			// ignore: cleanup is best-effort
		}

		try {
			console.error('\n------------------------------------');
			console.log('Initializing Elasticsearch testing indices\n');

			for (const { catalogId, esIndex, mappings, data } of catalogueConfigs) {
				console.debug('  - Creating index for', catalogId);
				await esClient.indices.create({
					index: esIndex,
					body: mappings,
				});

				for (const datum of data) {
					await esClient.create({
						index: esIndex,
						id: datum._id,
						body: datum._source,
					});
				}

				// Make the seeded documents searchable before any test queries run.
				await esClient.indices.refresh({ index: esIndex });
			}

			// Pre-create the sets index: in multicatalogue mode every catalogue router runs
			// `initializeSets` concurrently at startup, and when the index is missing the
			// creation race leaves the losing catalogue's GraphQL endpoint permanently
			// responding 500 (see tech-debt). Sets are disabled in this suite, so an empty
			// index is enough to make every router's existence check pass.
			await esClient.indices.create({ index: setsIndex, body: {} });

			console.log('\n  Success!');
		} catch (err) {
			console.error('------------------------------------');
			console.error('FATAL: Index setup failed - aborting tests\n');
			console.error(`  ${err}\n`);
			console.error('------------------------------------\n');
			process.exit(1);
		}

		try {
			console.error('\n------------------------------------');
			console.log('Setting up Arranger - Multicatalogue Mode for MCP tests\n');

			arrangerApp = await ArrangerServer({
				catalogueConfigsPath: './multiconfigs',
				disableDownloads: false,
				disableFilters: false,
				disablePlayground: false,
				enableAdmin: false,
				enableNetworkAggregation: undefined,
				enableSets: false,
				esClient,
				serverPort: arrangerPort,
				setsIndex,
				setsType,
			});
		} catch (err) {
			console.error('\n\n------------------------------------');
			console.error('FATAL: Arranger Server is not available - aborting tests\n');
			console.error(`  ${err instanceof Error ? err.stack : err}\n`);
			console.error('------------------------------------\n');
			process.exit(1);
		}

		try {
			console.error('\n------------------------------------');
			console.log('Starting MCP Server for tests\n');

			mcpServer = await startMcpServerForTest({
				arrangerBaseUrl,
				catalogues: configuredCatalogues,
				requestTimeoutMs: 5000,
				mcp: {
					host: '127.0.0.1',
					port: mcpPort,
					path: '/mcp',
					// Spelled out rather than derived: these are what a loopback bind resolves to,
					// and stating them keeps the suite honest if that defaulting ever changes.
					allowedHosts: ['localhost', '127.0.0.1', '[::1]'],
					allowedOrigins: ['localhost', '127.0.0.1', '[::1]'],
					maxBodyBytes: 102_400,
				},
			});
		} catch (err) {
			console.error('\n\n------------------------------------');
			console.error('FATAL: MCP Server failed to start (likely a connection issue with Arranger)\n');
			console.error(`  ${err instanceof Error ? err.stack : err}\n`);
			console.error('------------------------------------\n');
			process.exit(1);
		}

		try {
			console.error('\n------------------------------------');
			console.log('Connecting MCP Client over Streamable HTTP\n');

			const mcpClient = await connectMcpClient(mcpServer.url, 'arranger-mcp-server-integration-tests');
			context.mcpClient = mcpClient;
			context.mcpServerUrl = mcpServer.url;
		} catch (err) {
			console.error('\n\n------------------------------------');
			console.error('FATAL: MCP Client failed to connect to MCP Server\n');
			console.error(`  ${err instanceof Error ? err.stack : err}\n`);
			console.error('------------------------------------\n');
			process.exit(1);
		}
	});

	suite('Startup and active spinup', () => {
		spinupActive({ getClient, configuredCatalogues });
	});

	suite('Resources', () => {
		readResources({
			getClient,
			configuredCatalogues,
			expectedDocumentTypes,
			expectedFieldsByCatalogue,
		});
	});

	suite('Tools', () => {
		readTools({
			getClient,
			configuredCatalogues,
			expectedDocumentTypes,
			expectedFieldsByCatalogue,
		});
	});

	suite('Tools: build_sqon', () => {
		buildSqon({ getClient });
	});

	suite('Tools: execute_query', () => {
		executeQuery({ getClient, getServerUrl });
	});

	suite('Prompts', () => {
		readPrompts({
			getClient,
			configuredCatalogues,
			expectedDocumentTypes,
		});
	});

	after(async () => {
		try {
			await context.mcpClient?.close();
			console.log('\nDisconnected MCP Client\n');
		} catch (err) {
			console.warn('Warning: error closing MCP client:', err);
		}

		try {
			await mcpServer?.shutdown();
			console.log('\nStopped MCP Server\n');
		} catch (err) {
			console.warn('Warning: error shutting down MCP server:', err);
		}

		try {
			arrangerApp?.close();
			console.log('\nStopped Arranger Server\n');
		} catch (err) {
			console.warn('Warning: error closing Arranger server:', err);
		}

		try {
			await cleanupIndices();
			console.log('\nCleared Elasticsearch testing indices\n');
		} catch (err) {
			console.warn('Warning: error cleaning up indices:', err);
		}
	});
});
