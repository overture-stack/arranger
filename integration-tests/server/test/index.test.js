import { after, before, suite } from 'node:test';

import Arranger from '@overture-stack/arranger-server';
import ajax from '@overture-stack/arranger-server/dist/utils/ajax.js';
import express from 'express';

import buildSearchClient from '../../../modules/server/src/searchClient/index.js';

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
const esPass = process.env.ES_PASS || 'myelasticpassword';
const esUser = process.env.ES_USER || 'elastic';

const port = process.env.PORT || 5678;
const client = process.env.SEARCH_CLIENT_TYPE;

const app = express();

const api = ajax(`http://localhost:${port}`, {
	debugAll: DEBUG,
	endpoint: '/graphql',
});

suite('integration-tests/server', async () => {
	let server;
	const documentType = 'model';

	const esClient = await buildSearchClient({
		node: esHost,
		user: esUser,
		password: esPass,
		client,
	});

	const cleanup = async () => {
		await esClient.indices.delete({
			index: esIndex,
		});
		await esClient.indices.delete({
			index: setsIndex,
		});
	};

	before(
		async () => {
			console.log('\n(Initializing Elasticsearch and Arranger)');

			try {
				await cleanup();
			} catch (err) {
				console.error('Error running integration-tests cleanup');
				console.error(err);
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
					esPass,
					esUser,
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
				console.error('Error at integration-tests `before` hook:', err);
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
			console.error('Error in integration-tests/server `after` test hook');
			console.error(err);
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
