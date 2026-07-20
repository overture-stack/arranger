import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import path from 'path';

import { stringToNumber } from '@overture-stack/arranger-types/tools';
import axios from 'axios';
import dotenv from 'dotenv';

import ArrangerServer from '../../../apps/search-server/src/server.js';
import { buildSearchClient } from '../../../modules/graphql-router/src/index.js';
import { ajax } from '../../../modules/graphql-router/src/utils/index.js';
import catalog1Base from '../multiconfigs/catalog1/base.json' with { type: 'json' };
import catalog2Base from '../multiconfigs/catalog2/base.json' with { type: 'json' };

import data_1 from './assets/model_centric_1.data.json' with { type: 'json' };
import mappings_1 from './assets/model_centric_1.mappings.json' with { type: 'json' };
import data_2 from './assets/model_centric_2.data.json' with { type: 'json' };
import mappings_2 from './assets/model_centric_2.mappings.json' with { type: 'json' };
import manageSets from './manageSets.js';
import readAggregation from './readAggregation.js';
import readMetadata from './readMetadata.js';
import readSearchData from './readSearchData.js';
import checkBaseEndpoints from './spinupActive.js';

dotenv.config({ path: path.resolve('../../.env.test') });

const enableAdmin = true;
const esHost = process.env.ES_HOST || 'http://127.0.0.1:9200';
const esPass = process.env.ES_PASS;
const esUser = process.env.ES_USER;
const setsIndex = process.env.ES_ARRANGER_SETS_INDEX || 'arranger-sets-testing';
const setsType = process.env.ES_ARRANGER_SETS_TYPE || 'arranger-sets-testing';
const searchEngine = process.env.SEARCH_ENGINE || 'elasticsearch';
const serverPort = stringToNumber(process.env.SERVER_PORT, 5678);
const serverUrl = `http://localhost:${serverPort}`;

const rootApi = ajax(serverUrl, {});

const createCatalogueApi = (catalogId: string) =>
	ajax(serverUrl, {
		endpoint: `/${catalogId}/graphql`,
	});

const catalogueConfigs = [
	{
		catalogId: catalog1Base.catalogId,
		documentType: catalog1Base.documentType,
		esIndex: 'testing-models_1',
		data: data_1,
		mappings: mappings_1,
		gqlPath: `/${catalog1Base.catalogId}/graphql`,
		api: createCatalogueApi(catalog1Base.catalogId),
	},
	{
		catalogId: catalog2Base.catalogId,
		documentType: catalog2Base.documentType,
		esIndex: 'testing-models_2',
		data: data_2,
		mappings: mappings_2,
		gqlPath: `/${catalog2Base.catalogId}/graphql`,
		api: createCatalogueApi(catalog2Base.catalogId),
	},
];

const useESAuth = !!esPass && !!esUser;
const esClient = await buildSearchClient({
	// coerced type to verify the function handles unsupported values
	client: searchEngine,
	node: esHost,
	...(useESAuth && {
		username: esUser,
		password: esPass,
	}),
});

const cleanup = async (caller = '') => {
	// console.log('caller', caller);

	// Clean up all known test indices to ensure no leftovers
	const allTestIndices = [
		...catalogueConfigs.map((c) => c.esIndex), // multicatalogue indices
		setsIndex, // sets index
	];

	const uniqueIndices = [...new Set(allTestIndices)];

	const deletePromises = uniqueIndices.map(async (index) => {
		try {
			await esClient.indices.delete({ index });
		} catch (err) {
			// Ignore errors for indices that don't exist
			if (err?.meta?.body?.error?.type !== 'index_not_found_exception') {
				console.warn(`Warning: Could not delete index ${index}:`, err.message);
			}
		}
	});

	await Promise.all(deletePromises);
};

const runTestSuites = (env, { smokeTestConfig } = {}) => {
	// TODOL need a new suite specifically for aggressively adversarial tests.
	// the purpose is to try and break the server.
	// one being aggregation aliases that create increasingly larger response sizes
	// use complexity calculation packages to reject such requests

	if (smokeTestConfig) {
		suite('functional endpoints', () => {
			checkBaseEndpoints(smokeTestConfig);
		});
	}

	suite('metadata/configs reading', () => {
		readMetadata({ ...env, enableAdmin });
	});

	suite('search data reading', () => {
		readSearchData(env);
	});

	suite('aggregation reading', () => {
		readAggregation(env);
	});

	suite('sets management', () => {
		manageSets(env);
	});
};

suite('integration-tests/server', { concurrency: false }, () => {
	before(async () => {
		try {
			await cleanup('before all');
		} catch (err) {
			// console.log('err before', err);
		}

		try {
			console.error('\n------------------------------------');
			console.log('Initializing Elasticsearch testing indices\n');

			for (const { catalogId, data, esIndex, mappings } of catalogueConfigs) {
				console.debug('  - Creating index for', catalogId);
				await esClient.indices.create({
					index: esIndex,
					body: mappings,
				});

				for (const datum of data) {
					await esClient.index({
						index: esIndex,
						id: datum._id,
						body: datum._source,
						refresh: 'wait_for',
					});
				}
			}

			console.log('\n  Success!');
		} catch (err) {
			console.error('------------------------------------');
			console.error('FATAL: Index setup failed - aborting tests\n');
			console.error(`  ${err}\n`);
			console.error('------------------------------------\n');
			process.exit(1);
		}
	});

	suite('Single Catalogue Integration Tests', () => {
		let serverApp;

		before(async () => {
			console.error('\n------------------------------------');
			console.log('Setting up Arranger - Single Catalogue Mode\n');

			try {
				serverApp = await ArrangerServer({
					disableDownloads: false,
					disableFilters: false,
					disablePlayground: false,
					enableAdmin,
					// enableDebug: true,
					// enableLogs: true, // helpful to see test calls, etc.
					enableNetworkAggregation: undefined,
					enableSets: true,
					esClient,
					filters: () => ({
						op: 'not',
						content: [
							{
								op: 'in',
								content: {
									fieldName: 'access_denied',
									value: ['true'],
								},
							},
						],
					}),
					serverPort,
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
		});

		const [singleCatalogue] = catalogueConfigs;
		const env = {
			api: ajax(serverUrl, { endpoint: '/graphql' }),
			documentType: singleCatalogue.documentType,
		};

		runTestSuites(env, {
			smokeTestConfig: {
				api: rootApi,
				catalogs: [
					{
						documentType: singleCatalogue.documentType,
						gqlPath: '/graphql',
					},
				],
				mode: 'single',
			},
		});

		after(async () => {
			try {
				serverApp.close();
				console.log('\nStopped Arranger Server - Single Catalogue\n');
			} catch (err) {
				// console.log('err after', err);
			}
		});
	});

	suite('Multicatalogue Integration Tests', () => {
		let serverApp;

		before(async () => {
			console.error('\n------------------------------------');
			console.log('Setting up Arranger - Multicatalogue Mode\n');

			try {
				serverApp = await ArrangerServer({
					catalogueConfigsPath: './multiconfigs',
					disableDownloads: false,
					disableFilters: false,
					disablePlayground: false,
					enableAdmin,
					enableDebug: true,
					// enableLogs: true, // helpful to see test calls, etc.
					enableNetworkAggregation: undefined,
					enableSets: true,
					esClient,
					// FIXME: not fully integrated yet
					// should merge across catalogues with their own serverside filters
					filters: () => ({
						op: 'not',
						content: [
							{
								op: 'in',
								content: {
									fieldName: 'access_denied',
									value: ['true'],
								},
							},
						],
					}),
					serverPort,
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
		});

		suite('functional endpoints', () => {
			checkBaseEndpoints({
				api: rootApi,
				catalogs: catalogueConfigs.map(({ catalogId, documentType, gqlPath }) => ({
					catalogId,
					documentType,
					gqlPath,
				})),
				mode: 'multiple',
			});
		});

		catalogueConfigs.forEach((config) => {
			const catalogueEnv = {
				api: config.api,
				documentType: config.documentType,
			};

			suite(`Catalogue ${config.catalogId}`, () => {
				runTestSuites(catalogueEnv);
			});
		});

		after(async () => {
			try {
				serverApp.close();
				console.log('\nStopped Arranger Server - Multicatalogue\n');
			} catch (err) {
				// console.log('err after', err);
			}
		});
	});

	suite('GraphQL introspection disabled', () => {
		let serverApp;

		before(async () => {
			console.error('\n------------------------------------');
			console.log('Setting up Arranger - Introspection Disabled\n');

			try {
				serverApp = await ArrangerServer({
					disableGraphQLIntrospection: true,
					enableAdmin,
					esClient,
					serverPort,
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
		});

		test('rejects GraphQL introspection queries with a 400 response', async () => {
			const response = await axios.post(
				`${serverUrl}/graphql`,
				{ query: '{ __schema { queryType { name } } }' },
				{ validateStatus: () => true },
			);

			assert.equal(response.status, 400);
			assert.ok(Array.isArray(response.data?.errors) && response.data.errors.length > 0);
			assert.match(response.data.errors[0].message, /introspection/i);
		});

		after(async () => {
			try {
				serverApp.close();
				console.log('\nStopped Arranger Server - Introspection Disabled\n');
			} catch (err) {
				// console.log('err after', err);
			}
		});
	});

	suite('GraphQL batching (default disabled)', () => {
		let serverApp;

		before(async () => {
			console.error('\n------------------------------------');
			console.log('Setting up Arranger - Batching Default\n');

			try {
				serverApp = await ArrangerServer({
					enableAdmin,
					esClient,
					serverPort,
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
		});

		test('rejects an array of batched GraphQL operations with a 400 response when enableGraphQLBatching is left unset', async () => {
			const response = await axios.post(
				`${serverUrl}/graphql`,
				[{ query: '{ __typename }' }, { query: '{ __typename }' }],
				{ validateStatus: () => true },
			);

			assert.equal(response.status, 400);
			assert.ok(Array.isArray(response.data?.errors) && response.data.errors.length > 0);
			assert.match(response.data.errors[0].message, /batch/i);
		});

		test('still processes a single (non-batched) GraphQL operation', async () => {
			const response = await axios.post(
				`${serverUrl}/graphql`,
				{ query: '{ __typename }' },
				{ validateStatus: () => true },
			);

			assert.equal(response.status, 200);
			assert.ok(response.data?.data?.__typename);
		});

		after(async () => {
			try {
				serverApp.close();
				console.log('\nStopped Arranger Server - Batching Default\n');
			} catch (err) {
				// console.log('err after', err);
			}
		});
	});

	suite('GraphQL batching enabled', () => {
		let serverApp;

		before(async () => {
			console.error('\n------------------------------------');
			console.log('Setting up Arranger - Batching Enabled\n');

			try {
				serverApp = await ArrangerServer({
					enableAdmin,
					enableGraphQLBatching: true,
					esClient,
					serverPort,
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
		});

		test('processes an array of batched GraphQL operations', async () => {
			const response = await axios.post(
				`${serverUrl}/graphql`,
				[{ query: '{ __typename }' }, { query: '{ __typename }' }],
				{ validateStatus: () => true },
			);

			assert.equal(response.status, 200);
			assert.ok(Array.isArray(response.data));
			assert.equal(response.data.length, 2);
		});

		after(async () => {
			try {
				serverApp.close();
				console.log('\nStopped Arranger Server - Batching Enabled\n');
			} catch (err) {
				// console.log('err after', err);
			}
		});
	});

	after(async () => {
		try {
			await cleanup('after all');
			console.log('\nCleared Elasticsearch testing indices\n');
		} catch (err) {
			// console.log('err after', err);
		}
	});
});
