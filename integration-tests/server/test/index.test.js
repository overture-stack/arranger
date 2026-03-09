import { after, before, suite } from 'node:test';

import Arranger from '@overture-stack/arranger-server';
import ajax from '@overture-stack/arranger-server/dist/utils/ajax.js';
import express from 'express';

import getSearchClient from '../../../modules/server/src/searchClient/index.js';

// test modules
import data from './assets/model_centric.data.json';
import mappings from './assets/model_centric.mappings.json';
import manageSets from './manageSets.js';
import readAggregation from './readAggregation.js';
import readMetadata from './readMetadata.js';
import readSearchData from './readSearchData.js';
import checkBaseEndpoints from './spinupActive.js';

const DEBUG = (process.env.DEBUG || '').toLowerCase() === 'true';
const enableAdmin = (process.env.ENABLE_ADMIN || '').toLowerCase() === 'true';
const esHost = process.env.ES_HOST || 'http://127.0.0.1:9200';
const esIndex = process.env.ES_INDEX || 'testing-models_1.0';
const setsIndex = process.env.ES_ARRANGER_SET_INDEX || 'arranger-sets-testing';
const esPwd = process.env.ES_PASS;
const esUser = process.env.ES_USER;
const port = process.env.PORT || 5678;
const clientType = process.env.SEARCH_CLIENT;

const useAuth = !!esPwd && !!esUser;

const app = express();

const api = ajax(`http://localhost:${port}`, {
	debugAll: DEBUG,
	endpoint: '/graphql',
});

const esClient = await getSearchClient({
	...(useAuth && {
		auth: {
			username: esUser,
			password: esPwd,
		},
	}),
	node: esHost,
	clientType,
});

const cleanup = () => {
	return Promise.all([
		esClient.indices.delete({
			index: esIndex,
		}),
		esClient.indices.delete({
			index: setsIndex,
		}),
	]);
};

suite('integration-tests/server', () => {
	let server;
	const documentType = 'model';

	before(
		async () => {
			console.log('\n(Initializing Elasticsearch and Arranger)');

			try {
				await cleanup();
			} catch (err) {
				//
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
				const router = await Arranger({
					// needed to see the mapping
					enableAdmin,
					// This may be useful when troubleshooting tests
					enableLogs: true,
					esHost,
					getServerSideFilter: () => ({
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
					setsIndex,
				});

				app.use(router);

				await new Promise((resolve) => {
					server = app.listen(port, () => {
						resolve(null);
					});
				});

				console.log('******* Starting tests *******');
			} catch (err) {
				console.error('error:', err);
				throw err;
			}
		},
		{
			timeout: 10000,
		},
	);

	after(async () => {
		try {
			await cleanup();
			server?.close();
			console.log('\n(Cleared Elasticsearch and stopped Arranger Server)');
		} catch (err) {
			//
		}
	});

	const env = {
		api,
		documentType,
	};

	suite('basic endpoints functional', () => {
		checkBaseEndpoints({ ...env, server });
	});

	suite('metadata/configs reading', () => {
		readMetadata({ ...env, enableAdmin });
	});

	suite('search data reading', () => {
		readSearchData(env);
	});

	suite('aggregation reading', () => {
		readAggregation(env);
	});

	suite('manages sets', () => {
		manageSets(env);
	});
});
