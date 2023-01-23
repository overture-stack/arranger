import {} from 'mocha'; // Removes error ts2304 from "before" and "after" testing hooks
import { Client } from '@elastic/elasticsearch';
import express from 'express';
// import { print } from 'graphql';
// import gql from 'graphql-tag';
import Arranger from '@overture-stack/arranger-server';
// import Arranger, { adminGraphql } from '../../../modules/server/dist';
import ajax from '@overture-stack/arranger-server/dist/utils/ajax';

// test modules
import readMetadata from './readMetadata';
import readSearchData from './readSearchData';
import readAggregation from './readAggregation';
import manageSets from './manageSets';

const mappings = require('./assets/model_centric.mappings.json');
const data = require('./assets/model_centric.data.json');

const esHost = process.env.ES_HOST || 'http://127.0.0.1:9200';
const esIndex = process.env.ES_INDEX || 'models_1.0';
const esPwd = process.env.ES_PASS;
const esUser = process.env.ES_USER;
const port = process.env.PORT || 5678;

const useAuth = !!esPwd && !!esUser;

const app = express();

const api = ajax(`http://localhost:${port}`, 'debug!');
const esClient = new Client({
	...(useAuth && {
		auth: {
			username: esUser,
			password: esPwd,
		},
	}),
	node: esHost,
});

const cleanup = () =>
	Promise.all([
		esClient.indices.delete({
			index: esIndex,
		}),
	]);

describe('@overture-stack/arranger-server', () => {
	let server;
	const documentType = 'model';

	before('Initialise Elasticsearch and Arranger', async function () {
		this.timeout(10000);

		try {
			await cleanup();
		} catch (err) {}

		await esClient.indices.create({
			index: esIndex,
			body: mappings,
		});

		for (let datum of data) {
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
				enableAdmin: true,
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
			});

			app.use(router);

			// TODO: reenable once Admin is back online
			// const adminApp = await adminGraphql({ esHost });
			// adminApp.applyMiddleware({ app, path: adminPath });

			await new Promise((resolve) => {
				server = app.listen(port, () => {
					resolve(null);
				});
			});

			// TODO: reenable once Admin is back online
			// /**
			//  * uses the admin API to adds some metadata
			//  */
			// await api.post({
			//   endpoint: adminPath,
			//   body: {
			//     query: print(gql`
			//       mutation($projectId: String!) {
			//         newProject(id: $projectId) {
			//           id
			//           __typename
			//         }
			//       }
			//     `),
			//     variables: {
			//       projectId,
			//     },
			//   },
			// });

			// await api.post({
			//   endpoint: adminPath,
			//   body: {
			//     query: print(gql`
			//       mutation($projectId: String!, $documentType: String!, $esIndex: String!) {
			//         newIndex(projectId: $projectId, documentType: $documentType, esIndex: $esIndex) {
			//           id
			//         }
			//       }
			//     `),
			//     variables: {
			//       projectId,
			//       documentType,
			//       esIndex,
			//     },
			//   },
			// });
			console.log('******* Starting tests *******');
		} catch (err) {
			console.error('error:', err);
			throw err;
		}
	});

	after('Clear Elasticsearch and stop Arranger', async () => {
		server?.close();

		try {
			await cleanup();
		} catch (err) {}
	});

	const env = {
		api,
		documentType,
		gqlPath: '/graphql',
	};

	describe(' \n** metadata reading', () => {
		readMetadata(env);
	});

	describe(' \n** search data reading', () => {
		readSearchData(env);
	});

	describe(' \n** aggregation reading', () => {
		readAggregation(env);
	});

	describe('\n** manages sets', () => {
		manageSets(env);
	});
});
