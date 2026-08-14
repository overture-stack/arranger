import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { saveSet } from './resolveSets.js';

const buildTypes = (config) => [['donor', { name: 'donor', index: 'donor', nested_fieldNames: [], config }]];

suite('saveSet', () => {
	test('prefixes a real field used for sorting, but never the "_id" ES meta field, when nestingPrefix is configured', async () => {
		const searchCalls = [];
		const esClient = {
			search: async (params) => {
				searchCalls.push(params);
				return { body: { hits: { hits: [], total: { value: 0 } } } };
			},
			index: async () => undefined,
		};

		await saveSet({ getServerSideFilter: () => null, setsIndex: 'arranger-sets', types: buildTypes({ nestingPrefix: 'data' }) })(
			null,
			{
				type: 'donor',
				userId: 'user-1',
				sqon: { op: 'and', content: [] },
				path: 'submitter_donor_id',
				sort: [{ fieldName: 'bmi', order: 'asc' }],
			},
			{ esClient },
		);

		assert.deepEqual(searchCalls[0].sort, ['data.bmi:asc']);
	});

	test('does not prefix the default "_id" sort when no explicit sort is given, even with nestingPrefix configured', async () => {
		const searchCalls = [];
		const esClient = {
			search: async (params) => {
				searchCalls.push(params);
				return { body: { hits: { hits: [], total: { value: 0 } } } };
			},
			index: async () => undefined,
		};

		await saveSet({ getServerSideFilter: () => null, setsIndex: 'arranger-sets', types: buildTypes({ nestingPrefix: 'data' }) })(
			null,
			{ type: 'donor', userId: 'user-1', sqon: { op: 'and', content: [] }, path: 'submitter_donor_id' },
			{ esClient },
		);

		assert.deepEqual(searchCalls[0].sort, ['_id:asc']);
	});

	test('unwraps the enveloped _source before extracting set member ids by path', async () => {
		const indexCalls = [];
		const esClient = {
			search: async () => ({
				body: {
					hits: {
						hits: [{ _id: 'DO_1', _source: { data: { submitter_donor_id: 'DO_1' } }, sort: ['DO_1'] }],
						total: { value: 1 },
					},
				},
			}),
			index: async (params) => {
				indexCalls.push(params);
			},
		};

		await saveSet({ getServerSideFilter: () => null, setsIndex: 'arranger-sets', types: buildTypes({ nestingPrefix: 'data' }) })(
			null,
			{ type: 'donor', userId: 'user-1', sqon: { op: 'and', content: [] }, path: 'submitter_donor_id' },
			{ esClient },
		);

		assert.deepEqual(indexCalls[0].body.ids, ['DO_1']);
	});

	test('leaves sort field names unchanged when no nestingPrefix is configured', async () => {
		const searchCalls = [];
		const esClient = {
			search: async (params) => {
				searchCalls.push(params);
				return { body: { hits: { hits: [], total: { value: 0 } } } };
			},
			index: async () => undefined,
		};

		await saveSet({ getServerSideFilter: () => null, setsIndex: 'arranger-sets', types: buildTypes(undefined) })(
			null,
			{
				type: 'donor',
				userId: 'user-1',
				sqon: { op: 'and', content: [] },
				path: 'submitter_donor_id',
				sort: [{ fieldName: 'bmi', order: 'asc' }],
			},
			{ esClient },
		);

		assert.deepEqual(searchCalls[0].sort, ['bmi:asc']);
	});
});
