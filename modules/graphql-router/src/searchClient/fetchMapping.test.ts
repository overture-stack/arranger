import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { NESTING_PREFIX_NOT_FOUND_ERROR_NAME } from './classifyCatalogueFailureReason.js';
import { getIndexMapping, unwrapMapping } from './fetchMapping.js';
import type { SearchClient } from './types.js';

suite('unwrapMapping', () => {
	test('returns the mapping unchanged when no nestingPrefix is configured', () => {
		const mapping = { bmi: { type: 'float' } };

		assert.equal(unwrapMapping(mapping), mapping);
	});

	test('returns undefined unchanged when there is no mapping to unwrap', () => {
		assert.equal(unwrapMapping(undefined, 'data'), undefined);
	});

	test('unwraps a single-level nesting prefix, promoting its properties to the top level', () => {
		const mapping = {
			data: {
				type: 'object',
				properties: {
					bmi: { type: 'float' },
					submitter_donor_id: { type: 'keyword' },
				},
			},
		};

		const result = unwrapMapping(mapping, 'data');

		assert.deepEqual(result, {
			bmi: { type: 'float' },
			submitter_donor_id: { type: 'keyword' },
		});
	});

	test('walks down through a dotted, multi-level nesting prefix', () => {
		const mapping = {
			envelope: {
				properties: {
					payload: {
						properties: {
							bmi: { type: 'float' },
						},
					},
				},
			},
		};

		const result = unwrapMapping(mapping, 'envelope.payload');

		assert.deepEqual(result, { bmi: { type: 'float' } });
	});

	test('throws a NestingPrefixNotFoundError when the configured prefix is not found', () => {
		const mapping = { bmi: { type: 'float' } };

		assert.throws(
			() => unwrapMapping(mapping, 'data'),
			(error: unknown) => error instanceof Error && error.name === NESTING_PREFIX_NOT_FOUND_ERROR_NAME,
		);
	});
});

suite('getIndexMapping', () => {
	const buildSearchClient = (mappingProperties: Record<string, unknown>): SearchClient =>
		({
			cat: {
				aliases: async () => ({ body: [] }),
			},
			indices: {
				getMapping: async () => ({
					body: { donor: { mappings: { properties: mappingProperties } } },
				}),
			},
		}) as unknown as SearchClient;

	test('unwraps a nested mapping when nestingPrefix is configured', async () => {
		const searchClient = buildSearchClient({
			data: { properties: { bmi: { type: 'float' } } },
		});

		const mapping = await getIndexMapping({ nestingPrefix: 'data', searchClient, esIndex: 'donor' });

		assert.deepEqual(mapping, { bmi: { type: 'float' } });
	});

	test('leaves an already-flat mapping unchanged when no nestingPrefix is configured', async () => {
		const searchClient = buildSearchClient({ bmi: { type: 'float' } });

		const mapping = await getIndexMapping({ searchClient, esIndex: 'donor' });

		assert.deepEqual(mapping, { bmi: { type: 'float' } });
	});

	test('still drops the reserved "id" field after unwrapping a nested mapping', async () => {
		const searchClient = buildSearchClient({
			data: { properties: { id: { type: 'keyword' }, bmi: { type: 'float' } } },
		});

		const mapping = await getIndexMapping({ nestingPrefix: 'data', searchClient, esIndex: 'donor' });

		assert.deepEqual(mapping, { bmi: { type: 'float' } });
	});

	test('propagates a NestingPrefixNotFoundError when the configured prefix does not match the real mapping', async () => {
		const searchClient = buildSearchClient({ bmi: { type: 'float' } });

		await assert.rejects(
			getIndexMapping({ nestingPrefix: 'data', searchClient, esIndex: 'donor' }),
			(error: unknown) => error instanceof Error && error.name === NESTING_PREFIX_NOT_FOUND_ERROR_NAME,
		);
	});
});
