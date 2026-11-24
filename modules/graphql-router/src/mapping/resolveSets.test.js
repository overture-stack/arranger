import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import getDefaultServerSideFilter from '#accessControl/getDefaultServerSideFilter.js';
import { isSetsDisabledError } from '#sets/SetsDisabledError.js';

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
			enableSets: true,
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

		assert.deepEqual(searchCalls[0].sort, ['data.bmi:asc', '_id:asc']);
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
			enableSets: true,
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
			enableSets: true,
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
			enableSets: true,
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

		assert.deepEqual(searchCalls[0].sort, ['bmi:asc', '_id:asc']);
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
				enableSets: true,
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
									properties: {
										catalogue: { type: 'keyword' },
										ids: { type: 'keyword' },
										...(attribution && { attribution }),
									},
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
				enableSets: true,
				getRequester,
				getServerSideFilter: getDefaultServerSideFilter,
				setsIndex: 'arranger-sets',
				setsScope: { catalogue: 'catalogue-a', ownIndex: true },
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

	suite('paging through the matches a saved set records', () => {
		const DOTTED_SORT = [{ fieldName: 'gene_metadata.genomic_variant_count', order: 'asc' }];

		const donorDocument = (number, genomicVariantCount) => {
			const padded = String(number).padStart(5, '0');

			return {
				_id: `doc-${padded}`,
				_source: {
					submitter_donor_id: `DO_${padded}`,
					gene_metadata: { genomic_variant_count: genomicVariantCount },
				},
			};
		};

		const valueOf = (document, fieldName) =>
			fieldName === '_id'
				? document._id
				: fieldName.split('.').reduce((value, key) => value?.[key], document._source);

		const sortKeysOf = (sortStrings) =>
			sortStrings.map((sortString) => {
				const [fieldName, order] = sortString.split(':');

				return { descending: order === 'desc', fieldName };
			});

		const compareValues = (left, right) => {
			if (left === right) return 0;

			return left < right ? -1 : 1;
		};

		const compareTuples = (keys, left, right) =>
			keys.reduce(
				(result, { descending }, index) =>
					result || compareValues(left[index], right[index]) * (descending ? -1 : 1),
				0,
			);

		/**
		 * A search client that pages `documents` as the engine does: it orders them by the requested sort, resumes
		 * after `search_after`, and returns each hit's `sort` array built from that sort. Each `_source` nests its
		 * dotted fields, so no dotted key sits at its top level.
		 */
		const pagingEngine = (documents) => {
			const searchCalls = [];
			const pages = [];
			const indexCalls = [];
			const esClient = {
				search: async (params) => {
					searchCalls.push(params);

					const keys = sortKeysOf(params.sort);
					const searchAfter = params.body.search_after;

					if (searchAfter?.some((value) => value === undefined)) {
						throw new Error('null_pointer_exception: search_after has no value for a sort key');
					}

					const tupleOf = (document) => keys.map(({ fieldName }) => valueOf(document, fieldName));
					const ordered = [...documents].sort((left, right) =>
						compareTuples(keys, tupleOf(left), tupleOf(right)),
					);
					const remaining = searchAfter
						? ordered.filter((document) => compareTuples(keys, tupleOf(document), searchAfter) > 0)
						: ordered;
					const hits = remaining.slice(0, params.size).map((document) => ({
						_id: document._id,
						_source: document._source,
						sort: tupleOf(document),
					}));

					pages.push(hits);

					return { body: { hits: { hits, total: { value: documents.length } } } };
				},
				index: async (params) => {
					indexCalls.push(params);
				},
			};

			return { esClient, indexCalls, pages, searchCalls };
		};

		const saveDonors = (esClient, sort) =>
			saveSet({
				enableSets: true,
				getServerSideFilter: getDefaultServerSideFilter,
				setsIndex: 'arranger-sets',
				types: buildTypes(undefined),
			})(
				null,
				{ type: 'donor', userId: 'user-1', sqon: { op: 'and', content: [] }, path: 'submitter_donor_id', sort },
				{ esClient },
			);

		test('collects every matching id exactly once across three pages sorted by a dotted field', async () => {
			// Given 2,500 matches that share sort values across page boundaries
			const documents = Array.from({ length: 2500 }, (_, index) => donorDocument(index, index % 40));
			const engine = pagingEngine(documents);

			// When the set is saved, Then the paging covers all three pages and every id is collected once
			await saveDonors(engine.esClient, DOTTED_SORT);

			assert.equal(engine.searchCalls.length, 3);
			assert.deepEqual(
				[...engine.indexCalls[0].body.ids].sort(),
				documents.map(({ _source }) => _source.submitter_donor_id).sort(),
			);
		});

		test("sends each later page a search_after equal to the previous page's last hit sort array", async () => {
			// Given 2,500 matches that share sort values across page boundaries
			const documents = Array.from({ length: 2500 }, (_, index) => donorDocument(index, index % 40));
			const engine = pagingEngine(documents);

			// When the set is saved, Then each later page resumes after the last hit of the page before it
			await saveDonors(engine.esClient, DOTTED_SORT);

			assert.deepEqual(engine.searchCalls[1].body.search_after, engine.pages[0].at(-1).sort);
			assert.deepEqual(engine.searchCalls[2].body.search_after, engine.pages[1].at(-1).sort);
		});

		test("carries a sort value of 0 on the last hit of a page into the next page's search_after", async () => {
			// Given 1,001 matches whose first 1,000 sort to 0, so page one ends on a 0
			const documents = Array.from({ length: 1001 }, (_, index) => donorDocument(index, index < 1000 ? 0 : 5));
			const engine = pagingEngine(documents);

			// When the set is saved, Then the next page resumes after the 0 rather than an absent value
			await saveDonors(engine.esClient, DOTTED_SORT);

			assert.equal(engine.searchCalls[1].body.search_after[0], 0);
			assert.deepEqual(engine.searchCalls[1].body.search_after, engine.pages[0].at(-1).sort);
		});

		test('sends a caller\'s sort with "_id" appended as its last key', async () => {
			// Given a caller sort that does not end in "_id"
			const engine = pagingEngine([]);

			// When the set is saved, Then the engine receives the caller's sort followed by "_id" ascending
			await saveDonors(engine.esClient, [{ fieldName: 'gene_metadata.genomic_variant_count', order: 'desc' }]);

			assert.deepEqual(engine.searchCalls[0].sort, ['gene_metadata.genomic_variant_count:desc', '_id:asc']);
		});

		test('sends a caller\'s sort that already ends in "_id" unchanged', async () => {
			// Given a caller sort that already ends in "_id"
			const engine = pagingEngine([]);

			// When the set is saved, Then the engine receives that sort exactly as given
			await saveDonors(engine.esClient, [
				{ fieldName: 'bmi', order: 'desc' },
				{ fieldName: '_id', order: 'desc' },
			]);

			assert.deepEqual(engine.searchCalls[0].sort, ['bmi:desc', '_id:desc']);
		});

		test('sends the default sort unchanged, as "_id:asc" alone', async () => {
			// Given no caller sort
			const engine = pagingEngine([]);

			// When the set is saved, Then the engine receives the default sort with no appended key
			await saveDonors(engine.esClient, undefined);

			assert.deepEqual(engine.searchCalls[0].sort, ['_id:asc']);
		});

		test('stops paging on a short page, even when the reported total is larger', async () => {
			// Given a first page of two hits against a reported total of five, and a client that fails a second request
			const searchCalls = [];
			const indexCalls = [];
			const esClient = {
				search: async (params) => {
					searchCalls.push(params);

					if (searchCalls.length > 1) throw new Error('paged past a short page');

					return {
						body: {
							hits: {
								hits: [
									{ _id: 'doc-1', _source: { submitter_donor_id: 'DO_1' }, sort: ['doc-1'] },
									{ _id: 'doc-2', _source: { submitter_donor_id: 'DO_2' }, sort: ['doc-2'] },
								],
								total: { value: 5 },
							},
						},
					};
				},
				index: async (params) => {
					indexCalls.push(params);
				},
			};

			// When the set is saved, Then only the one page is requested and its ids are kept
			await saveDonors(esClient, undefined);

			assert.equal(searchCalls.length, 1);
			assert.deepEqual(indexCalls[0].body.ids, ['DO_1', 'DO_2']);
		});

		test('stops paging on an empty page, even when the reported total is larger', async () => {
			// Given an empty first page against a reported total of ten, and a client that fails a second request
			const searchCalls = [];
			const indexCalls = [];
			const esClient = {
				search: async (params) => {
					searchCalls.push(params);

					if (searchCalls.length > 1) throw new Error('paged past an empty page');

					return { body: { hits: { hits: [], total: { value: 10 } } } };
				},
				index: async (params) => {
					indexCalls.push(params);
				},
			};

			// When the set is saved, Then only the one page is requested and no ids are collected
			await saveDonors(esClient, DOTTED_SORT);

			assert.equal(searchCalls.length, 1);
			assert.deepEqual(indexCalls[0].body.ids, []);
		});
	});

	suite('when saved sets are not enabled', () => {
		const recordingClient = () => {
			const searchCalls = [];
			const indexCalls = [];
			const esClient = {
				search: async (params) => {
					searchCalls.push(params);
					return { body: { hits: { hits: [], total: { value: 0 } } } };
				},
				index: async (params) => {
					indexCalls.push(params);
				},
			};

			return { esClient, indexCalls, searchCalls };
		};

		test('refuses a saved set with the disabled-feature refusal, before any search or write', async () => {
			// Given saved sets disabled, and a recording search client
			const { esClient, indexCalls, searchCalls } = recordingClient();

			// When a saved set is saved, Then it is refused and the search client records no call
			await assert.rejects(
				saveSet({
					enableSets: false,
					getServerSideFilter: getDefaultServerSideFilter,
					setsIndex: 'arranger-sets',
					types: buildTypes({ nestingPrefix: 'data' }),
				})(
					null,
					{ type: 'donor', userId: 'user-1', sqon: { op: 'and', content: [] }, path: 'submitter_donor_id' },
					{ esClient },
				),
				isSetsDisabledError,
			);
			assert.deepEqual(searchCalls, []);
			assert.deepEqual(indexCalls, []);
		});

		test('refuses a saved set whose filter looks up another saved set, before any search', async () => {
			// Given saved sets disabled, and a recording search client
			const { esClient, searchCalls } = recordingClient();

			// When a saved set is saved from a filter naming a saved set, Then it is refused before any search
			await assert.rejects(
				saveSet({
					enableSets: false,
					getServerSideFilter: getDefaultServerSideFilter,
					setsIndex: 'arranger-sets',
					types: buildTypes(undefined),
				})(
					null,
					{
						type: 'donor',
						userId: 'user-1',
						sqon: { content: { fieldName: 'donor_id', value: ['set_id:abc'] }, op: 'in' },
						path: 'submitter_donor_id',
					},
					{ esClient },
				),
				isSetsDisabledError,
			);
			assert.deepEqual(searchCalls, []);
		});
	});
});

suite('saveSet records the catalogue a set was saved from', () => {
	/** A set the engine holds under `SET_ID`, saved from `catalogue`, with `ids`. */
	const storedSet = (fields) => ({
		_source: { ids: ['rec-1'], path: 'submitter_donor_id', type: 'donor', ...fields },
	});

	/**
	 * Saves a set through the router's save path over an engine whose sets index maps `catalogue` as given, returning
	 * what was indexed, each search run, and what the mutation answered or threw.
	 */
	const saveWith = async ({
		catalogueMapping,
		getRequester,
		setsScope,
		sqon = { content: [], op: 'and' },
		stored = {},
	}) => {
		const indexCalls = [];
		const searchCalls = [];
		const esClient = {
			get: async ({ id }) => {
				if (!(id in stored)) {
					throw Object.assign(new Error('not found'), { meta: { statusCode: 404 } });
				}

				return { body: { found: true, ...stored[id] } };
			},
			indices: {
				getMapping: async () => ({
					body: {
						'arranger-sets': {
							mappings: {
								properties: {
									attribution: { type: 'keyword' },
									ids: { type: 'keyword' },
									...(catalogueMapping && { catalogue: catalogueMapping }),
								},
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

		const answer = await saveSet({
			enableSets: true,
			getRequester,
			getServerSideFilter: getDefaultServerSideFilter,
			setsIndex: 'arranger-sets',
			setsScope,
			types: buildTypes(undefined),
		})(null, { type: 'donor', userId: 'user-1', sqon, path: 'submitter_donor_id' }, { esClient }).then(
			(saved) => ({ saved }),
			(error) => ({ error }),
		);

		return { ...answer, indexCalls, searchCalls };
	};

	const PRINCIPAL = () => ({ id: 'subject-r1', kind: 'principal' });

	test('records the scope catalogue on the saved set where the index maps catalogue as a keyword, without getRequester', async () => {
		const { indexCalls } = await saveWith({
			catalogueMapping: { type: 'keyword' },
			setsScope: { catalogue: 'correlation', ownIndex: true },
		});

		assert.equal(indexCalls[0].body.catalogue, 'correlation');
	});

	test('records the scope catalogue, and the principal, under getRequester where the index maps catalogue as a keyword', async () => {
		const { indexCalls } = await saveWith({
			catalogueMapping: { type: 'keyword' },
			getRequester: PRINCIPAL,
			setsScope: { catalogue: 'correlation', ownIndex: true },
		});

		assert.equal(indexCalls[0].body.catalogue, 'correlation');
		assert.equal(indexCalls[0].body.attribution, 'principal');
	});

	test('saves without a catalogue, with no getRequester, where the index does not map catalogue', async () => {
		const { indexCalls, saved } = await saveWith({
			catalogueMapping: undefined,
			setsScope: { catalogue: 'correlation', ownIndex: true },
		});

		assert.equal(saved !== undefined, true);
		assert.equal(Object.hasOwn(indexCalls[0].body, 'catalogue'), false);
	});

	test('refuses a save under getRequester where the index cannot record catalogue, naming it and the migration section, and stores nothing', async () => {
		const { error, indexCalls } = await saveWith({
			catalogueMapping: undefined,
			getRequester: PRINCIPAL,
			setsScope: { catalogue: 'correlation', ownIndex: true },
		});

		assert.match(error?.message ?? '', /catalogue/u);
		assert.match(error?.message ?? '', /#sets-index-per-catalogue/u);
		assert.equal(error?.name, 'AccessControlError');
		assert.deepEqual(indexCalls, []);
	});

	test('answers a set_id clause naming a set saved from another catalogue as a missing set, so the save selects nothing of it', async () => {
		// Given a set held under another catalogue, which the save's own filter names
		const { searchCalls, saved } = await saveWith({
			catalogueMapping: { type: 'keyword' },
			getRequester: PRINCIPAL,
			setsScope: { catalogue: 'correlation', documentType: 'donor', ownIndex: false, peerDocumentTypes: [] },
			sqon: { content: { fieldName: 'submitter_donor_id', value: ['set_id:OTHER'] }, op: 'in' },
			stored: {
				OTHER: storedSet({ attribution: 'unattributed', catalogue: 'mutation', setId: 'OTHER', type: 'donor' }),
			},
		});

		// Then the search compiles that set to no values at all
		assert.equal(saved !== undefined, true);
		assert.match(
			JSON.stringify(searchCalls[0]?.body?.query ?? {}),
			/"terms":\{"submitter_donor_id":\[\],"boost":0\}/u,
		);
	});
});
