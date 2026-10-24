import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { recordsAttribution } from './setsIndexMapping.js';

/** A search client whose sets index mappings answer as given, or whose mapping read fails. */
const answering = (getMapping: () => Promise<unknown>) => ({ indices: { getMapping } }) as never;

const mappingWith = (attribution?: unknown) => ({
	mappings: { properties: { ids: { type: 'keyword' }, ...(attribution !== undefined && { attribution }) } },
});

suite('recordsAttribution', () => {
	test('records marks in a sets index mapping attribution as a keyword', async () => {
		const esClient = answering(async () => ({ body: { 'arranger-sets': mappingWith({ type: 'keyword' }) } }));

		assert.equal(await recordsAttribution({ esClient, setsIndex: 'arranger-sets' }), true);
	});

	for (const [description, body] of [
		['lacking attribution', { 'arranger-sets': mappingWith() }],
		['mapping attribution as text', { 'arranger-sets': mappingWith({ type: 'text' }) }],
		[
			'reached through an alias where one of its indices lacks attribution',
			{ 'arranger-sets-1': mappingWith({ type: 'keyword' }), 'arranger-sets-2': mappingWith() },
		],
		['whose mapping holds no index', {}],
	] as const) {
		test(`records no mark in a sets index ${description}`, async () => {
			const esClient = answering(async () => ({ body }));

			assert.equal(await recordsAttribution({ esClient, setsIndex: 'arranger-sets' }), false);
		});
	}

	test('records no mark where the mapping cannot be read', async () => {
		const esClient = answering(async () => {
			throw new Error('security_exception: action [indices:admin/mappings/get] is unauthorized');
		});

		assert.equal(await recordsAttribution({ esClient, setsIndex: 'arranger-sets' }), false);
	});

	test('records no mark where the search client cannot read mappings at all', async () => {
		assert.equal(
			await recordsAttribution({ esClient: { indices: {} } as never, setsIndex: 'arranger-sets' }),
			false,
		);
	});
});
