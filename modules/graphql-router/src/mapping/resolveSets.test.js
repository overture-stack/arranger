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

		await saveSet({
			getServerSideFilter: getDefaultServerSideFilter,
			setsIndex: 'arranger-sets',
			types: buildTypes({ nestingPrefix: 'data' }),
		})(
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

		await saveSet({
			getServerSideFilter: getDefaultServerSideFilter,
			setsIndex: 'arranger-sets',
			types: buildTypes({ nestingPrefix: 'data' }),
		})(
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

		await saveSet({
			getServerSideFilter: getDefaultServerSideFilter,
			setsIndex: 'arranger-sets',
			types: buildTypes({ nestingPrefix: 'data' }),
		})(
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

		await saveSet({
			getServerSideFilter: getDefaultServerSideFilter,
			setsIndex: 'arranger-sets',
			types: buildTypes(undefined),
		})(
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

		test('stores the userId the client sends, and answers it as null, since no reader is given it', async () => {
			const { answer, stored } = await saveUnder({});

			assert.equal(stored.userId, 'user-1');
			assert.equal(answer.userId, null);
		});
	});

	suite('the mark a saved set records', () => {
		const PRINCIPAL = () => ({ id: 'subject-r1', kind: 'principal' });

		/**
		 * Saves a set where the sets index maps attribution as given, undefined leaving it out, returning the searches
		 * run, what was stored, and what the mutation answered or threw.
		 */
		const saveWhereIndexMaps = async ({ attribution, getRequester }) => {
			const searchCalls = [];
			const indexCalls = [];
			const esClient = {
				indices: {
					getMapping: async () => ({
						body: {
							'arranger-sets': {
								mappings: {
									properties: { ids: { type: 'keyword' }, ...(attribution && { attribution }) },
								},
							},
						},
					}),
				},
				index: async (params) => {
					indexCalls.push(params);
				},
				search: async (params) => {
					searchCalls.push(params);
					return { body: { hits: { hits: [], total: { value: 0 } } } };
				},
			};

			const outcome = await saveSet({
				getRequester,
				getServerSideFilter: getDefaultServerSideFilter,
				setsIndex: 'arranger-sets',
				types: buildTypes(undefined),
			})(
				null,
				{ type: 'donor', userId: 'user-1', sqon: { op: 'and', content: [] }, path: 'submitter_donor_id' },
				{ esClient },
			).then(
				(answer) => ({ answer }),
				(error) => ({ error }),
			);

			return { ...outcome, searchCalls, stored: indexCalls.map(({ body }) => body) };
		};

		test('records a principal and its id where the sets index maps attribution as a keyword', async () => {
			const { stored } = await saveWhereIndexMaps({ attribution: { type: 'keyword' }, getRequester: PRINCIPAL });

			assert.deepEqual(
				stored.map(({ attribution, userId }) => ({ attribution, userId })),
				[{ attribution: 'principal', userId: 'subject-r1' }],
			);
		});

		for (const [description, attribution] of [
			['lacks attribution', undefined],
			['maps attribution as text', { type: 'text' }],
		]) {
			test(`refuses a principal's save as a configuration failure, naming the mapping fix and reading no record, where the sets index ${description}`, async () => {
				const { error, searchCalls, stored } = await saveWhereIndexMaps({
					attribution,
					getRequester: PRINCIPAL,
				});

				assert.equal(error?.name, 'AccessControlError');
				assert.match(error?.message ?? '', /#sets-index-attribution/u);
				assert.deepEqual({ searchCalls, stored }, { searchCalls: [], stored: [] });
			});

			test(`saves a set unmarked, writing no attribution, with no getRequester where the sets index ${description}`, async () => {
				const { answer, stored } = await saveWhereIndexMaps({ attribution, getRequester: undefined });

				assert.ok(answer, 'the set was not saved');
				assert.deepEqual(
					stored.map((body) => Object.hasOwn(body, 'attribution')),
					[false],
				);
			});
		}

		test('marks a set unattributed with no getRequester where the sets index maps attribution as a keyword', async () => {
			const { stored } = await saveWhereIndexMaps({ attribution: { type: 'keyword' }, getRequester: undefined });

			assert.deepEqual(
				stored.map(({ attribution, userId }) => ({ attribution, userId })),
				[{ attribution: 'unattributed', userId: 'user-1' }],
			);
		});
	});
});
