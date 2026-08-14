import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import type { SQONType } from '@overture-stack/arranger-components';

import { buildNetworkQueryFetchArgs } from './useNetworkQuery.js';

suite('buildNetworkQueryFetchArgs', () => {
	test('passes apiUrl through as url, so network chart queries reach the same catalogue-scoped base as the rest of the provider', () => {
		const args = buildNetworkQueryFetchArgs({
			apiUrl: 'https://arranger-search.dev.overture.bio/donor',
			networkNodesFilter: ['node-a'],
			query: 'query { donor { aggregations { status { buckets { key doc_count } } } } }',
			sqon: null,
		});

		assert.equal(args.url, 'https://arranger-search.dev.overture.bio/donor');
	});

	test('passes url as undefined when apiUrl is omitted (single-catalogue mode)', () => {
		const args = buildNetworkQueryFetchArgs({
			query: 'query { donor { aggregations { status { buckets { key doc_count } } } } }',
			sqon: null,
		});

		assert.equal(args.url, undefined);
	});

	test('defaults nodesFilter to an empty array when networkNodesFilter is omitted', () => {
		const args = buildNetworkQueryFetchArgs({
			query: 'query { donor { aggregations { status { buckets { key doc_count } } } } }',
			sqon: null,
		});

		assert.deepEqual(args.body.variables.nodesFilter, []);
	});

	test('passes sqon through as the filters variable, unchanged', () => {
		const sqon: SQONType = { op: 'and', content: [] };

		const args = buildNetworkQueryFetchArgs({
			query: 'query { donor { hits { total } } }',
			sqon,
		});

		assert.equal(args.body.variables.filters, sqon);
		assert.equal(args.body.query, 'query { donor { hits { total } } }');
	});
});
