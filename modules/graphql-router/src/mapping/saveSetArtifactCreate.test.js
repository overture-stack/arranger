import assert from 'node:assert/strict';
import { mock, suite, test } from 'node:test';

import {
	AccessControlDeniedError,
	AccessControlUnavailableError,
	isAccessControlDeniedError,
} from '#accessControl/AccessControlError.js';
import getDefaultServerSideFilter from '#accessControl/getDefaultServerSideFilter.js';

import { saveSet } from './resolveSets.js';

const SET_TYPES = [['donor', { name: 'donor', index: 'donor', nested_fieldNames: [], config: undefined }]];

/** A narrow artifact-create filter: the records whose study is B. */
const STUDY_B_ONLY = () => ({ content: { fieldName: 'study', value: ['B'] }, op: 'in' });

/** A view filter restricting the catalogue to study A, so the count must carry it too. */
const STUDY_A_VIEW = () => ({ content: { fieldName: 'study', value: ['A'] }, op: 'in' });

const denyingCreate = () => {
	throw new AccessControlDeniedError({ catalogue: 'donor', kind: 'no-artifact-create' });
};

/** A response the engine answered from every shard, counting exactly, as the check requires. */
const exactBody = ({ hits, total }) => ({
	_shards: { failed: 0, successful: 1, total: 1 },
	hits: { hits, total: { relation: 'eq', value: total } },
	timed_out: false,
});

const hitFor = (id) => ({ _id: id, _source: { submitter_donor_id: id }, sort: [id] });

/**
 * A search client whose id search returns `ids`, and whose count search (the one with `size` 0) returns `countTotal`,
 * recording every search and index call.
 */
const fakeSearchClient = ({ countTotal = 0, ids }) => {
	const searches = [];
	const indexes = [];
	const esClient = {
		index: async (params) => {
			indexes.push(params);
		},
		search: async (params) => {
			searches.push(params);

			if (params.size === 0) {
				return { body: exactBody({ hits: [], total: countTotal }) };
			}

			return { body: exactBody({ hits: ids.map(hitFor), total: ids.length }) };
		},
	};

	return { esClient, indexes, searches };
};

/** Saves a donor set under the given create filter, with the view `getServerSideFilter`, and the client's engine. */
const saveDonorSet = ({ client, getArtifactCreateFilter, getServerSideFilter = getDefaultServerSideFilter }) =>
	saveSet({
		enableSets: true,
		getArtifactCreateFilter,
		getServerSideFilter,
		setsIndex: 'arranger-sets',
		types: SET_TYPES,
	})(null, { path: 'submitter_donor_id', type: 'donor', userId: 'user-1' }, { esClient: client.esClient });

const countSearchesOf = (searches) => searches.filter((search) => search.size === 0);

suite('saveSet against the artifact-create filter', () => {
	test('makes no count search and saves the set when no artifact-create filter is given', async () => {
		// Given a client whose selection holds two records
		const client = fakeSearchClient({ ids: ['DO_1', 'DO_2'] });

		// When the set is saved with no artifact-create filter
		const saved = await saveDonorSet({ client });

		// Then only the search for its ids runs, and the set is stored with both
		assert.equal(client.searches.length, 1);
		assert.deepEqual(client.indexes[0].body.ids, ['DO_1', 'DO_2']);
		assert.deepEqual(saved.ids, ['DO_1', 'DO_2']);
	});

	test('makes no count search when the artifact-create filter allows every record', async () => {
		// Given an artifact-create filter that includes everything
		const client = fakeSearchClient({ countTotal: 5, ids: ['DO_1'] });

		// When the set is saved under it
		await saveDonorSet({ client, getArtifactCreateFilter: getDefaultServerSideFilter });

		// Then no count search runs, and the set is stored
		assert.equal(countSearchesOf(client.searches).length, 0);
		assert.equal(client.indexes.length, 1);
	});

	test('saves the whole selection when every selected record is inside a narrow artifact-create filter', async () => {
		// Given a narrow filter the engine counts no selected record outside of
		const client = fakeSearchClient({ countTotal: 0, ids: ['DO_1', 'DO_2'] });

		// When the set is saved under it
		const saved = await saveDonorSet({ client, getArtifactCreateFilter: STUDY_B_ONLY });

		// Then the count search runs once, and every id is stored, none narrowed away
		assert.equal(countSearchesOf(client.searches).length, 1);
		assert.deepEqual(client.indexes[0].body.ids, ['DO_1', 'DO_2']);
		assert.deepEqual(saved.ids, ['DO_1', 'DO_2']);
	});

	test('refuses the whole set with no-artifact-create, storing nothing, when a selected record falls outside a narrow filter', async () => {
		// Given a narrow filter the engine counts one selected record outside of
		const client = fakeSearchClient({ countTotal: 1, ids: ['DO_1', 'DO_2'] });

		// When the set is saved under it
		const attempt = saveDonorSet({ client, getArtifactCreateFilter: STUDY_B_ONLY });

		// Then the save is refused as no-artifact-create, and nothing is indexed
		await assert.rejects(attempt, (error) => {
			assert.ok(isAccessControlDeniedError(error));
			assert.equal(error.kind, 'no-artifact-create');
			assert.equal(error.catalogue, 'donor');
			return true;
		});
		assert.equal(client.indexes.length, 0);
	});

	test('refuses a set whose selection matches no record when the artifact-create filter denies', async () => {
		// Given a filter that denies, and a selection holding no record at all
		const client = fakeSearchClient({ ids: [] });

		// When the set is saved under it
		const attempt = saveDonorSet({ client, getArtifactCreateFilter: denyingCreate });

		// Then the denial propagates, and nothing is indexed
		await assert.rejects(
			attempt,
			(error) => isAccessControlDeniedError(error) && error.kind === 'no-artifact-create',
		);
		assert.equal(client.indexes.length, 0);
	});

	test('propagates a denial thrown by the artifact-create filter, storing nothing', async () => {
		// Given a filter that denies, over a selection holding records
		const client = fakeSearchClient({ ids: ['DO_1'] });

		// When the set is saved under it
		const attempt = saveDonorSet({ client, getArtifactCreateFilter: denyingCreate });

		// Then the denial propagates unchanged, and nothing is indexed
		await assert.rejects(
			attempt,
			(error) => isAccessControlDeniedError(error) && error.kind === 'no-artifact-create',
		);
		assert.equal(client.indexes.length, 0);
	});

	test('saves an empty set under a narrow filter without a count search', async () => {
		// Given a narrow filter and a selection holding no records
		const client = fakeSearchClient({ countTotal: 3, ids: [] });

		// When the set is saved under it
		const saved = await saveDonorSet({ client, getArtifactCreateFilter: STUDY_B_ONLY });

		// Then nothing is counted, and the empty set is stored
		assert.equal(countSearchesOf(client.searches).length, 0);
		assert.deepEqual(saved.ids, []);
		assert.equal(client.indexes.length, 1);
	});

	test('counts a selected record lacking the create filter field as outside it, under the view filter', async () => {
		// Given a narrow filter, a view filter restricting to study A, and a selection of two records
		const client = fakeSearchClient({ countTotal: 0, ids: ['DO_1', 'DO_2'] });

		// When the set is saved
		await saveDonorSet({ client, getArtifactCreateFilter: STUDY_B_ONLY, getServerSideFilter: STUDY_A_VIEW });

		// Then the count query matches the selected ids, and negates the create filter inside the view filter
		const [countSearch] = countSearchesOf(client.searches);

		// A record with no study matches the must_not, so it is counted as outside the filter.
		assert.deepEqual(countSearch.body.query, {
			bool: {
				filter: [
					{ terms: { submitter_donor_id: ['DO_1', 'DO_2'] } },
					{
						bool: {
							must: [
								{ terms: { study: ['A'], boost: 0 } },
								{ bool: { must_not: [{ terms: { study: ['B'], boost: 0 } }] } },
							],
						},
					},
				],
			},
		});
		assert.equal(countSearch.body.track_total_hits, true);
		assert.equal(countSearch.allow_partial_search_results, false);
	});
});

suite('saveSet artifact-create check, by saved value, path-less record, chunk and exact answer', () => {
	/** A client whose id search returns `hits`, and whose count search answers `countOf(query)` as an exact count. */
	const clientAnswering = ({ countOf, hits }) => {
		const searches = [];
		const indexes = [];
		const esClient = {
			index: async (params) => {
				indexes.push(params);
			},
			search: async (params) => {
				searches.push(params);
				if (params.size === 0) {
					return { body: exactBody({ hits: [], total: countOf(params.body.query) }) };
				}
				return { body: exactBody({ hits, total: hits.length }) };
			},
		};

		return { esClient, indexes, searches };
	};

	const saveWith = ({ artifactCreateChunkSize, client, getArtifactCreateFilter = STUDY_B_ONLY }) =>
		saveSet({
			artifactCreateChunkSize,
			enableSets: true,
			getArtifactCreateFilter,
			getServerSideFilter: getDefaultServerSideFilter,
			setsIndex: 'arranger-sets',
			types: SET_TYPES,
		})(null, { path: 'submitter_donor_id', type: 'donor', userId: 'user-1' }, { esClient: client.esClient });

	test('refuses when two records share a saved path value and one of them falls outside the filter', async () => {
		// Given two records holding the same path value, with the engine counting one record outside the filter
		const client = clientAnswering({
			countOf: () => 1,
			hits: [hitFor('DO_1'), { _id: 'R_2', _source: { submitter_donor_id: 'DO_1' }, sort: ['R_2'] }],
		});

		// When the set is saved
		const attempt = saveWith({ client });

		// Then the save is refused as no-artifact-create, and the saved value is matched once, by its path
		await assert.rejects(
			attempt,
			(error) => isAccessControlDeniedError(error) && error.kind === 'no-artifact-create',
		);
		assert.equal(client.indexes.length, 0);
		const [countSearch] = countSearchesOf(client.searches);
		assert.deepEqual(countSearch.body.query.bool.filter[0], { terms: { submitter_donor_id: ['DO_1'] } });
	});

	test('refuses when a path-less record falls outside the filter, matching it by its _id', async () => {
		// Given a record lacking the saved path, saved by its _id, which the engine counts outside the filter
		const client = clientAnswering({
			countOf: (query) => (JSON.stringify(query).includes('"_id":["LOOSE_1"]') ? 1 : 0),
			hits: [{ _id: 'LOOSE_1', _source: {}, sort: ['LOOSE_1'] }],
		});

		// When the set is saved
		const attempt = saveWith({ client });

		// Then the save is refused, and the path-less record was counted by its _id
		await assert.rejects(
			attempt,
			(error) => isAccessControlDeniedError(error) && error.kind === 'no-artifact-create',
		);
		assert.equal(client.indexes.length, 0);
	});

	test('refuses when a record outside the filter sits in the second chunk, indexing nothing, after stopping at the hit', async () => {
		// Given three saved values checked two to a chunk, with the record outside the filter holding the third
		const client = clientAnswering({
			countOf: (query) => (JSON.stringify(query).includes('DO_3') ? 1 : 0),
			hits: [hitFor('DO_1'), hitFor('DO_2'), hitFor('DO_3')],
		});

		// When the set is saved with that chunk size
		const attempt = saveWith({ artifactCreateChunkSize: 2, client });

		// Then the save is refused, nothing is indexed, and the chunks ran one after another, two counts in all
		await assert.rejects(
			attempt,
			(error) => isAccessControlDeniedError(error) && error.kind === 'no-artifact-create',
		);
		assert.equal(client.indexes.length, 0);
		assert.equal(countSearchesOf(client.searches).length, 2);
	});

	test('stops counting at the first chunk holding a record outside the filter', async () => {
		// Given three saved values checked one to a chunk, with the first chunk already holding a record outside
		const client = clientAnswering({
			countOf: (query) => (JSON.stringify(query).includes('DO_1') ? 1 : 0),
			hits: [hitFor('DO_1'), hitFor('DO_2'), hitFor('DO_3')],
		});

		// When the set is saved
		await saveWith({ artifactCreateChunkSize: 1, client }).catch(() => undefined);

		// Then only the first chunk was counted
		assert.equal(countSearchesOf(client.searches).length, 1);
	});

	test('refuses with an ordinary error, not a denial, when the engine answers a count without exactness, indexing nothing', async () => {
		// Given a count answered by a shard that failed
		const esClient = {
			index: async () => {
				throw new Error('index must not be reached');
			},
			search: async (params) =>
				params.size === 0
					? {
							body: {
								...exactBody({ hits: [], total: 0 }),
								_shards: { failed: 1, successful: 0, total: 1 },
							},
						}
					: { body: exactBody({ hits: [hitFor('DO_1')], total: 1 }) },
		};
		const logged = mock.method(console, 'error', () => {});

		try {
			// When the set is saved
			const attempt = saveSet({
				enableSets: true,
				getArtifactCreateFilter: STUDY_B_ONLY,
				getServerSideFilter: getDefaultServerSideFilter,
				setsIndex: 'arranger-sets',
				types: SET_TYPES,
			})(null, { path: 'submitter_donor_id', type: 'donor', userId: 'user-1' }, { esClient });

			// Then the save fails as an ordinary error rather than a denial, and the failure is logged
			await assert.rejects(attempt, (error) => error instanceof Error && !isAccessControlDeniedError(error));
			assert.ok(
				logged.mock.calls.some(
					(call) => JSON.parse(String(call.arguments[0])).event === 'sets.artifact_create_check_failed',
				),
				'expected the failed check to be logged',
			);
		} finally {
			logged.mock.restore();
		}
	});

	test('fails closed, indexing nothing, when the saved path lies inside a nested field the check cannot count per record', async () => {
		// Given a catalogue whose saved path lies inside a nested field
		const client = clientAnswering({ countOf: () => 0, hits: [hitFor('DO_1')] });
		const logged = mock.method(console, 'error', () => {});

		try {
			// When the set is saved under a create filter
			const attempt = saveSet({
				enableSets: true,
				getArtifactCreateFilter: STUDY_B_ONLY,
				getServerSideFilter: getDefaultServerSideFilter,
				setsIndex: 'arranger-sets',
				types: [['donor', { name: 'donor', index: 'donor', nested_fieldNames: ['files'], config: undefined }]],
			})(
				null,
				{ path: 'files.submitter_donor_id', type: 'donor', userId: 'user-1' },
				{ esClient: client.esClient },
			);

			// Then the save is refused as an ordinary error, nothing is indexed, and the failure is logged
			await assert.rejects(attempt, (error) => error instanceof Error && !isAccessControlDeniedError(error));
			assert.equal(client.indexes.length, 0);
			assert.ok(
				logged.mock.calls.some(
					(call) => JSON.parse(String(call.arguments[0])).event === 'sets.artifact_create_check_failed',
				),
			);
		} finally {
			logged.mock.restore();
		}
	});

	test('fails closed, indexing nothing and logging it, when the create filter names a saved set the save did not resolve', async () => {
		// Given a requester, so the save resolves the saved sets its filters name, and a create filter naming a set
		// the save did not resolve
		const client = clientAnswering({ countOf: () => 0, hits: [hitFor('DO_1')] });
		const esClient = {
			...client.esClient,
			indices: {
				getMapping: async () => ({
					body: {
						'arranger-sets': {
							mappings: {
								properties: {
									attribution: { type: 'keyword' },
									catalogue: { type: 'keyword' },
									ids: { type: 'keyword' },
								},
							},
						},
					},
				}),
			},
		};
		const logged = mock.method(console, 'error', () => {});

		try {
			// When the set is saved under it
			const attempt = saveSet({
				enableSets: true,
				getArtifactCreateFilter: () => ({
					content: { fieldName: 'submitter_donor_id', value: ['set_id:abc'] },
					op: 'in',
				}),
				getRequester: () => ({ id: 'subject-r1', kind: 'principal' }),
				getServerSideFilter: getDefaultServerSideFilter,
				setsIndex: 'arranger-sets',
				setsScope: { catalogue: 'catalogue-a', ownIndex: true },
				types: SET_TYPES,
			})(null, { path: 'submitter_donor_id', type: 'donor', userId: 'user-1' }, { esClient });

			// Then the save throws, nothing is indexed, and the failure is logged
			await assert.rejects(attempt, Error);
			assert.equal(client.indexes.length, 0);
			assert.ok(
				logged.mock.calls.some(
					(call) => JSON.parse(String(call.arguments[0])).event === 'sets.artifact_create_check_failed',
				),
			);
		} finally {
			logged.mock.restore();
		}
	});
});

suite('saveSet for a suspended principal', () => {
	const saveAsSuspended = ({ client, getArtifactCreateFilter, getServerSideFilter }) =>
		saveSet({
			enableSets: true,
			getArtifactCreateFilter,
			getRequester: () => ({ kind: 'suspended', retryAfterSeconds: 5 }),
			getServerSideFilter,
			setsIndex: 'arranger-sets',
			types: SET_TYPES,
		})(null, { path: 'submitter_donor_id', type: 'donor' }, { esClient: client.esClient });

	test("answers the host's own refusal, so the host's event is the one logged", async () => {
		// Given a host whose filter refuses a suspended principal itself
		const client = fakeSearchClient({ ids: ['DO_1'] });
		const refusal = new AccessControlUnavailableError('suspended', { retryAfterSeconds: 7 });
		const getServerSideFilter = mock.fn(() => {
			throw refusal;
		});

		// When a suspended principal saves a set
		// Then the host's refusal is the one thrown, and nothing reaches the engine
		await assert.rejects(
			saveAsSuspended({ client, getArtifactCreateFilter: STUDY_B_ONLY, getServerSideFilter }),
			refusal,
		);
		assert.equal(getServerSideFilter.mock.callCount(), 1);
		assert.deepEqual([client.searches, client.indexes], [[], []]);
	});

	test('still refuses where the host serves a suspended principal, before the engine is reached', async () => {
		// Given a host whose callbacks serve everyone
		const client = fakeSearchClient({ ids: ['DO_1'] });

		// When a suspended principal saves a set
		// Then the GraphQL router refuses it as unavailable, and nothing reaches the engine
		await assert.rejects(
			saveAsSuspended({
				client,
				getArtifactCreateFilter: undefined,
				getServerSideFilter: getDefaultServerSideFilter,
			}),
			(error) => error instanceof AccessControlUnavailableError && error.retryAfterSeconds === 5,
		);
		assert.deepEqual([client.searches, client.indexes], [[], []]);
	});
});
