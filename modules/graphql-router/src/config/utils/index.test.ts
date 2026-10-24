import assert from 'node:assert/strict';
import { format } from 'node:util';
import { mock, suite, test } from 'node:test';

import { initializeSets } from './index.js';

const makeEsClient = (existsStatusCode: number) =>
	({
		indices: {
			create: async () => ({ acknowledged: true }),
			exists: async () => ({ statusCode: existsStatusCode }),
		},
	}) as any;

/** The mapping the engine answers for `indexName`, its `sqon` property as given. */
const mappingAnswer = (indexName: string, sqon: unknown) => ({
	body: { [indexName]: { mappings: { properties: { ids: { type: 'keyword' }, sqon } } } },
});

const FILTER_AS_DATA = { enabled: false, type: 'object' };

/** Runs `work` with console.warn captured, returning each line it wrote. */
const withWarningsCaptured = async (work: () => Promise<unknown>): Promise<string[]> => {
	const lines: string[] = [];
	const warnings = mock.method(console, 'warn', (...args: unknown[]) => {
		lines.push(format(...args));
	});

	try {
		await work();
		return lines;
	} finally {
		warnings.mock.restore();
	}
};

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
				getMapping: async () => mappingAnswer('arranger-sets', FILTER_AS_DATA),
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

	test("creates the sets index storing each saved set's filter as data, never indexed", async () => {
		// Given an engine holding no sets index, recording what it is asked to create
		const created: unknown[] = [];
		const esClient = {
			indices: {
				create: async (request: unknown) => {
					created.push(request);
					return { acknowledged: true };
				},
				exists: async () => ({ statusCode: 404 }),
			},
		} as any;

		// When the router initializes its sets
		await initializeSets({ enableSets: true, esClient, setsIndex: 'arranger-sets' });

		// Then the index it creates stores each set's filter as data
		assert.deepEqual(
			created.map((request: any) => request.body.mappings.properties.sqon),
			[FILTER_AS_DATA],
		);
	});

	for (const [description, indexName] of [
		['by its own name', 'arranger-sets'],
		['through an alias to another index', 'arranger-sets-2024'],
	] as const) {
		test(`warns, naming the index and the migration section, when an existing sets index reached ${description} does not store each set's filter as data`, async () => {
			// Given an existing sets index whose filter property holds mapped fields
			const esClient = {
				indices: {
					exists: async () => ({ statusCode: 200 }),
					getMapping: async () => mappingAnswer(indexName, { properties: { op: { type: 'text' } } }),
				},
			} as any;

			// When the router initializes its sets
			const lines = await withWarningsCaptured(() =>
				initializeSets({ enableSets: true, esClient, setsIndex: 'arranger-sets' }),
			);

			// Then it warns once, naming the index it read and the migration section, and starts
			assert.equal(lines.length, 1, JSON.stringify(lines));
			assert.match(lines[0] ?? '', /sets\.index_mapping_outdated/u);
			assert.match(lines[0] ?? '', new RegExp(indexName, 'u'));
			assert.match(lines[0] ?? '', /#sets-index-filter-as-data/u);
		});
	}

	test("starts without a warning beside an existing sets index storing each set's filter as data", async () => {
		const esClient = {
			indices: {
				exists: async () => ({ statusCode: 200 }),
				getMapping: async () => mappingAnswer('arranger-sets', FILTER_AS_DATA),
			},
		} as any;

		assert.deepEqual(
			await withWarningsCaptured(() =>
				initializeSets({ enableSets: true, esClient, setsIndex: 'arranger-sets' }),
			),
			[],
		);
	});

	test("warns that the sets index's mapping went unchecked, and starts, when the engine will not show it", async () => {
		// Given an engine refusing to show the existing sets index's mapping, as a role without permission to does
		const esClient = {
			indices: {
				exists: async () => ({ statusCode: 200 }),
				getMapping: async () => {
					throw new Error('security_exception: action [indices:admin/mappings/get] is unauthorized');
				},
			},
		} as any;

		// When the router initializes its sets, Then it starts, warning once that the mapping was not checked
		const lines = await withWarningsCaptured(() =>
			initializeSets({ enableSets: true, esClient, setsIndex: 'arranger-sets' }),
		);
		assert.equal(lines.length, 1, JSON.stringify(lines));
		assert.match(lines[0] ?? '', /sets\.index_mapping_unchecked/u);
		assert.match(lines[0] ?? '', /arranger-sets/u);
	});
});
