import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { initializeSets } from './index.js';

const makeEsClient = (existsStatusCode: number) =>
	({
		indices: {
			create: async () => ({ acknowledged: true }),
			exists: async () => ({ statusCode: existsStatusCode }),
		},
	}) as any;

suite('initializeSets', () => {
	test('skips all index operations when enableSets is false', async () => {
		let called = false;
		const esClient = {
			indices: {
				create: async () => {
					called = true;
				},
				exists: async () => {
					called = true;
				},
			},
		} as any;

		await initializeSets({ enableSets: false, esClient, setsIndex: 'arranger-sets' });

		assert.equal(called, false);
	});

	test('skips all index operations when enableSets is omitted', async () => {
		let called = false;
		const esClient = {
			indices: {
				create: async () => {
					called = true;
				},
				exists: async () => {
					called = true;
				},
			},
		} as any;

		await initializeSets({ esClient, setsIndex: 'arranger-sets' });

		assert.equal(called, false);
	});

	test('creates the index when it does not exist', async () => {
		let created = false;
		const esClient = {
			indices: {
				create: async () => {
					created = true;
					return { acknowledged: true };
				},
				exists: async () => ({ statusCode: 404 }),
			},
		} as any;

		await initializeSets({ enableSets: true, esClient, setsIndex: 'arranger-sets' });

		assert.equal(created, true);
	});

	test('skips creation when the index already exists', async () => {
		let created = false;
		const esClient = {
			indices: {
				create: async () => {
					created = true;
				},
				exists: async () => ({ statusCode: 200 }),
			},
		} as any;

		await initializeSets({ enableSets: true, esClient, setsIndex: 'arranger-sets' });

		assert.equal(created, false);
	});

	test('throws when index creation fails', async () => {
		const esClient = makeEsClient(404);
		(esClient.indices as any).create = async () => null;

		await assert.rejects(
			() => initializeSets({ enableSets: true, esClient, setsIndex: 'arranger-sets' }),
			/Problem creating arranger-sets index/,
		);
	});

	test('treats resource_already_exists_exception as success', async () => {
		const raceError = Object.assign(new Error('race'), {
			meta: { body: { error: { type: 'resource_already_exists_exception' } } },
		});
		const esClient = {
			indices: {
				create: async () => {
					throw raceError;
				},
				exists: async () => ({ statusCode: 404 }),
			},
		} as any;

		await assert.doesNotReject(() => initializeSets({ enableSets: true, esClient, setsIndex: 'arranger-sets' }));
	});

	test('rethrows non-race errors from index creation', async () => {
		const networkError = Object.assign(new Error('connection refused'), {
			meta: { body: { error: { type: 'connection_error' } } },
		});
		const esClient = {
			indices: {
				create: async () => {
					throw networkError;
				},
				exists: async () => ({ statusCode: 404 }),
			},
		} as any;

		await assert.rejects(
			() => initializeSets({ enableSets: true, esClient, setsIndex: 'arranger-sets' }),
			/connection refused/,
		);
	});
});
