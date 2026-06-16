import { after, before, suite } from 'node:test';
import path from 'path';

import { stringToNumber } from '@overture-stack/arranger-types/tools';
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

const createCatalogApi = (catalogId: string) =>
	ajax(serverUrl, {
		endpoint: `/${catalogId}/graphql`,
	});

const catalogConfigs = [
	{
		catalogId: catalog1Base.catalogId,
		documentType: catalog1Base.documentType,
		esIndex: 'testing-models_1',
		data: data_1,
		mappings: mappings_1,
		gqlPath: `/${catalog1Base.catalogId}/graphql`,
		api: createCatalogApi(catalog1Base.catalogId),
	},
	{
		catalogId: catalog2Base.catalogId,
		documentType: catalog2Base.documentType,
		esIndex: 'testing-models_2',
		data: data_2,
		mappings: mappings_2,
		gqlPath: `/${catalog2Base.catalogId}/graphql`,
		api: createCatalogApi(catalog2Base.catalogId),
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
		...catalogConfigs.map((c) => c.esIndex), // multicatalog indices
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

			for (const { catalogId, data, esIndex, mappings } of catalogConfigs) {
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

	suite('Single Catalog Integration Tests', () => {
		let serverApp;

		before(async () => {
			console.error('\n------------------------------------');
			console.log('Setting up Arranger - Single Catalog Mode\n');

			try {
				serverApp = await ArrangerServer({
					disableDownloads: false,
					disableFilters: false,
					disablePlayground: false,
					disableSets: false,
					enableAdmin,
					// enableDebug: true,
					// enableLogs: true, // helpful to see test calls, etc.
					enableNetworkAggregation: undefined,
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

		const [singleCatalog] = catalogConfigs;
		const env = {
			api: ajax(serverUrl, { endpoint: '/graphql' }),
			documentType: singleCatalog.documentType,
		};

		runTestSuites(env, {
			smokeTestConfig: {
				api: rootApi,
				catalogs: [
					{
						documentType: singleCatalog.documentType,
						gqlPath: '/graphql',
					},
				],
				mode: 'single',
			},
		});

		after(async () => {
			try {
				serverApp.close();
				console.log('\nStopped Arranger Server - Single Catalog\n');
			} catch (err) {
				// console.log('err after', err);
			}
		});
	});

	suite('Multicatalog Integration Tests', () => {
		let serverApp;

		before(async () => {
			console.error('\n------------------------------------');
			console.log('Setting up Arranger - Multicatalog Mode\n');

			try {
				serverApp = await ArrangerServer({
					catalogConfigsPath: './multiconfigs',
					disableDownloads: false,
					disableFilters: false,
					disablePlayground: false,
					disableSets: false,
					enableAdmin,
					enableDebug: true,
					// enableLogs: true, // helpful to see test calls, etc.
					enableNetworkAggregation: undefined,
					esClient,
					// FIXME: not fully integrated yet
					// should merge across catalogs with their own serverside filters
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
				catalogs: catalogConfigs.map(({ catalogId, documentType, gqlPath }) => ({
					catalogId,
					documentType,
					gqlPath,
				})),
				mode: 'multiple',
			});
		});

		catalogConfigs.forEach((config) => {
			const catalogEnv = {
				api: config.api,
				documentType: config.documentType,
			};

			suite(`Catalog ${config.catalogId}`, () => {
				runTestSuites(catalogEnv);
			});
		});

		after(async () => {
			try {
				serverApp.close();
				console.log('\nStopped Arranger Server - Multicatalog\n');
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
