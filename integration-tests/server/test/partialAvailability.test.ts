import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import path from 'path';

import { stringToNumber } from '@overture-stack/arranger-types/tools';
import axios from 'axios';
import dotenv from 'dotenv';

import ArrangerServer from '../../../apps/search-server/src/server.js';
import { buildSearchClient } from '../../../modules/graphql-router/src/index.js';

dotenv.config({ path: path.resolve('../../.env.test') });

const esHost = process.env.ES_HOST || 'http://127.0.0.1:9200';
const esPass = process.env.ES_PASS;
const esUser = process.env.ES_USER;
const setsIndex = process.env.ES_ARRANGER_SETS_INDEX || 'arranger-sets-testing-partial';
const setsType = process.env.ES_ARRANGER_SETS_TYPE || 'arranger-sets-testing-partial';
const searchEngine = process.env.SEARCH_ENGINE || 'elasticsearch';
// Distinct port from integration-tests/server/test/index.test.ts (5678 default) so both files
// can run concurrently without an EADDRINUSE collision.
const serverPort = stringToNumber(process.env.SERVER_PORT, 5678) + 1;
const serverUrl = `http://localhost:${serverPort}`;

const healthyIndex = 'testing-partial-availability';

const useESAuth = !!esPass && !!esUser;
const esClient = await buildSearchClient({
	client: searchEngine,
	node: esHost,
	...(useESAuth && { username: esUser, password: esPass }),
});

// Real-ES coverage for "Multicatalog catalogue lifecycle and metadata": one catalogue's index
// exists and is queryable, a second catalogue's configured index was never created. Confirms the
// server starts (rather than crashing, the pre-fix behaviour), reports `degraded` with a
// `failed`/`index_not_found` entry for the broken catalogue, keeps serving the healthy one, and
// that `/ready` still returns 200 for a merely `degraded` server.
suite('integration-tests/server: partial catalogue availability', { concurrency: false }, () => {
	let serverApp: Awaited<ReturnType<typeof ArrangerServer>>;

	before(async () => {
		try {
			await esClient.indices.delete({ index: healthyIndex });
		} catch {
			// ignore if it doesn't already exist
		}

		await esClient.indices.create({
			index: healthyIndex,
			body: { mappings: { properties: { name: { type: 'keyword' } } } },
		});

		await esClient.index({
			index: healthyIndex,
			id: '1',
			body: { name: 'a widget' },
			refresh: 'wait_for',
		});

		serverApp = await ArrangerServer({
			catalogueConfigsPath: './multiconfigs-partial',
			esClient,
			serverPort,
			setsIndex,
			setsType,
		});
	});

	after(async () => {
		serverApp?.close();

		try {
			await esClient.indices.delete({ index: healthyIndex });
		} catch {
			// ignore
		}
	});

	test('server introspection reports the healthy catalogue as available and the broken one as failed, with a degraded aggregate', async () => {
		const response = await axios.get(`${serverUrl}/introspection`, { validateStatus: () => true });

		assert.equal(response.status, 200);
		assert.equal(response.data.status, 'degraded');
		assert.equal(response.data.catalogs['catalogue-partial-healthy']?.status, 'available');
		assert.equal(response.data.catalogs['catalogue-partial-broken']?.status, 'failed');
		assert.equal(response.data.catalogs['catalogue-partial-broken']?.error?.code, 'index_not_found');
		assert.equal(typeof response.data.catalogs['catalogue-partial-broken']?.error?.message, 'string');
	});

	test("the broken catalogue's own introspection endpoint returns 200 with its status, not a crash or a bare 404", async () => {
		const response = await axios.get(`${serverUrl}/introspection/catalogue-partial-broken`, {
			validateStatus: () => true,
		});

		assert.equal(response.status, 200);
		assert.equal(response.data.status, 'failed');
		assert.equal(response.data.error?.code, 'index_not_found');
		assert.equal(response.data.documentType, 'widget');
		assert.equal(response.data.description, 'A catalogue whose index was never created, for testing.');
		assert.equal(response.data.details, undefined); // only the 404 catch-all carries the pointer back to this endpoint
	});

	test("the broken catalogue's GraphQL endpoint returns 404 with the same status body", async () => {
		const response = await axios.post(
			`${serverUrl}/catalogue-partial-broken/graphql`,
			{ query: '{ __typename }' },
			{ validateStatus: () => true },
		);

		assert.equal(response.status, 404);
		assert.equal(response.data.status, 'failed');
		assert.equal(response.data.error?.code, 'index_not_found');
	});

	test('the healthy catalogue keeps serving GraphQL queries alongside the broken one', async () => {
		const response = await axios.post(
			`${serverUrl}/catalogue-partial-healthy/graphql`,
			{ query: '{ __typename }' },
			{ validateStatus: () => true },
		);

		assert.equal(response.status, 200);
		assert.ok(response.data?.data?.__typename);
	});

	test('the readiness endpoint returns 200 while degraded (real traffic can still be served)', async () => {
		const response = await axios.get(`${serverUrl}/ready`, { validateStatus: () => true });

		assert.equal(response.status, 200);
		assert.equal(response.data.status, 'degraded');
	});
});
