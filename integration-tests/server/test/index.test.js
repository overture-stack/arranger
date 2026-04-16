import { after, before, suite } from 'node:test';
import path from 'path';

import { stringToNumber } from '@overture-stack/arranger-types/tools';
import dotenv from 'dotenv';

import ArrangerServer from '../../../apps/search-server/src/server.js';
import { buildSearchClient } from '../../../modules/graphql-router/src/index.js';
import { ajax } from '../../../modules/graphql-router/src/utils/index.js';

import data from './assets/model_centric.data.json';
import mappings from './assets/model_centric.mappings.json';
import manageSets from './manageSets.js';
import readAggregation from './readAggregation.js';
import readMetadata from './readMetadata.js';
import readSearchData from './readSearchData.js';
import checkBaseEndpoints from './spinupActive.js';

dotenv.config({ path: path.resolve('../../.env.test') });

const documentType = 'model';
const esHost = process.env.ES_HOST || 'http://127.0.0.1:9200';
const esIndex = process.env.ES_INDEX || 'testing-models_1.0';
const esPass = process.env.ES_PASS;
const esUser = process.env.ES_USER;
const setsIndex = process.env.ES_ARRANGER_SETS_INDEX || 'arranger-sets-testing';
const setsType = process.env.ES_ARRANGER_SETS_TYPE || 'arranger-sets-testing';
const searchEngine = process.env.SEARCH_ENGINE;
const serverPort = stringToNumber(process.env.SERVER_PORT, 5678);

const consumerMockApi = ajax(`http://localhost:${serverPort}`, {
	// NOTE: useful to see response details. can be loud
	debugAll: false,
	endpoint: '/graphql',
});

const useESAuth = !!esPass && !!esUser;
const esClient = await buildSearchClient({
	client: searchEngine,
	node: esHost,
	...(useESAuth && {
		username: esUser,
		password: esPass,
	}),
});

// TODOL need a new suite specifically for aggressively adversarial tests.
// the purpose is to try and break the server.

const env = {
	api: consumerMockApi,
	documentType,
};

const cleanup = ({ esIndex, setsIndex }) => {
	return Promise.all([
		esClient.indices.delete({
			// TODO: will need to map through catalogs when multicatalog is implemented
			index: esIndex,
		}),
		esClient.indices.delete({
			index: setsIndex,
		}),
	]);
};

suite('integration-tests/server', () => {
	let serverApp;

	before(
		async () => {
			console.log('\n(Initializing Elasticsearch and Arranger)\n');

			try {
				await cleanup({ esIndex, setsIndex });
			} catch (err) {
				// console.log('err before', err);
			}

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

			try {
				serverApp = await ArrangerServer({
					disableDownloads: false,
					disableFilters: false,
					disablePlayground: false,
					disableSets: false,
					enableAdmin: true, // needed to see the introspection and mapping
					enableDebug: true,
					enableLogs: false, // helpful to see test calls, etc.
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

				console.log('\n\n******* Starting tests *******');
			} catch (err) {
				console.error('error:', err);
				throw 'Could not start Arranger Server to run tests';
			}
		},
		{
			timeout: 10000,
		},
	);

	after(async () => {
		try {
			await cleanup({ esIndex, setsIndex });
			serverApp.close();
			console.log('\n(Cleared Elasticsearch and stopped Arranger Server)\n');
		} catch (err) {
			// console.log('err after', err);
		}
	});

	suite('functional endpoints', () => {
		checkBaseEndpoints({ ...env, serverApp });
	});

	suite('metadata/configs reading', () => {
		readMetadata({ ...env, enableAdmin: true });
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
});
