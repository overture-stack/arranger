import { after, before, describe } from 'node:test';

import express from 'express';

import Arranger, { adminGraphql } from '../../../modules/server/dist/index.js';
import ajax from '../../../modules/server/dist/utils/ajax.js';
import buildSearchClient from '../../../modules/server/src/searchClient/index.js';

import addProject from './addProject.js';
import file_centric_mapppings from './assets/file_centric.mappings.json';

const port = process.env.ES_PORT || 5678;
const esHost = process.env.ES_HOST || 'http://127.0.0.1:9200';
const esIndex = process.env.ES_INDEX || 'file_centric';
const client = process.env.SEARCH_CLIENT_TYPE;
const esPwd = process.env.ES_PASS;
const esUser = process.env.ES_USER;

const app = express();

const api = ajax(`http://localhost:${port}`);

const esClient = await buildSearchClient({
	node: esHost,
	user: esUser,
	password: esPwd,
	client,
});

const cleanup = () =>
	Promise.all([
		esClient.indices.delete({
			index: esIndex,
		}),
		esClient.indices.delete({
			index: 'arranger-projects*',
		}),
	]);

describe('@arranger/admin', () => {
	let server;
	const adminPath = '/admin/graphql';
	before(async () => {
		console.log('===== Initializing Elasticsearch data =====');
		try {
			await cleanup();
		} catch (err) {
			console.error('Error at Arranger Admin `before` test hook');
			console.error(err);
		}
		await esClient.indices.create({
			index: esIndex,
			body: file_centric_mapppings,
		});

		console.log('===== Starting arranger app for test =====');
		const router = await Arranger({ esHost, enableAdmin: false });
		const adminApp = await adminGraphql({ esHost });
		adminApp.applyMiddleware({ app, path: adminPath });
		app.use(router);
		await new Promise((resolve) => {
			server = app.listen(port, () => {
				resolve();
			});
		});
	});
	after(async () => {
		server?.close();
		await cleanup();
	});

	const env = {
		api,
		esIndex,
		adminPath,
	};
	addProject(env);
});
