import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import getDefaultServerSideFilter from '#accessControl/getDefaultServerSideFilter.js';

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

		await saveSet({ getServerSideFilter: getDefaultServerSideFilter, setsIndex: 'arranger-sets', types: buildTypes({ nestingPrefix: 'data' }) })(
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

		await saveSet({ getServerSideFilter: getDefaultServerSideFilter, setsIndex: 'arranger-sets', types: buildTypes({ nestingPrefix: 'data' }) })(
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

		await saveSet({ getServerSideFilter: getDefaultServerSideFilter, setsIndex: 'arranger-sets', types: buildTypes({ nestingPrefix: 'data' }) })(
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

		await saveSet({ getServerSideFilter: getDefaultServerSideFilter, setsIndex: 'arranger-sets', types: buildTypes(undefined) })(
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

	suite('the filter a saved set records', () => {
		const CLIENT_FILTER = { op: 'and', content: [{ op: 'in', content: { fieldName: 'name', value: ['x'] } }] };

		/** Saves a set under `context`, returning what was stored and what the mutation answered. */
		const saveUnder = async (context) => {
			const indexCalls = [];
			const esClient = {
				search: async () => ({ body: { hits: { hits: [], total: { value: 0 } } } }),
				index: async (params) => {
					indexCalls.push(params);
				},
			};

			const answer = await saveSet({
				getServerSideFilter: getDefaultServerSideFilter,
				setsIndex: 'arranger-sets',
				types: buildTypes(undefined),
			})(
				null,
				{ type: 'donor', userId: 'user-1', sqon: CLIENT_FILTER, path: 'submitter_donor_id' },
				{ esClient, ...context },
			);

			return { answer, stored: indexCalls[0].body };
		};

		test("is the client's filter as sent, where client filters apply", async () => {
			const { answer, stored } = await saveUnder({});

			assert.deepEqual(stored.sqon, CLIENT_FILTER);
			assert.deepEqual(answer.sqon, CLIENT_FILTER);
		});

		test('is none, where client filters are disabled, since no client filter selected its ids', async () => {
			const { answer, stored } = await saveUnder({ disableClientFilters: true });

			assert.equal(stored.sqon, null);
			assert.equal(answer.sqon, null);
		});
	});
});
