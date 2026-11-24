import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { groupSetsIndexes, planSetsIndexes, type SetsCatalogueSource } from './setsIndexGroups.js';
import { mayUseSetById, type SetsScope } from './setsAccess.js';

const SET_X = 'set-x';
const ANONYMOUS = { kind: 'anonymous' } as const;

/** A functional catalogue whose resolution is the given index and origin. */
const functional = (
	catalogueId: string,
	documentType: string,
	resolution: { index: string; origin: 'configured' | 'default' | 'legacy-shared' },
	configuredIndex?: string,
): SetsCatalogueSource => ({
	catalogueId,
	configuredIndex,
	derivedIndex: resolution.index,
	documentType,
	legacyName: 'arranger-sets',
	loaded: true,
	resolution: { index: resolution.index, kind: 'index', origin: resolution.origin },
});

/** A catalogue whose data index did not load, whose config implies the given sets index. */
const failed = (catalogueId: string, documentType: string, derivedIndex: string): SetsCatalogueSource => ({
	catalogueId,
	derivedIndex,
	documentType,
	legacyName: 'arranger-sets',
	loaded: false,
});

const peerIdsOf = (groups: Record<string, { catalogueId: string }[]>, catalogueId: string) =>
	(groups[catalogueId] ?? []).map((peer) => peer.catalogueId).sort();

suite('groupSetsIndexes', () => {
	test('gives a catalogue in a legacy shared index every other catalogue naming no sets index, and every failed one', () => {
		// Given a functional catalogue in the legacy shared index, a catalogue naming no index that also resolved
		// there, one naming its own index, and one that did not load
		const groups = groupSetsIndexes([
			functional('correlation', 'records', { index: 'arranger-sets', origin: 'legacy-shared' }),
			functional('mutation', 'records', { index: 'arranger-sets', origin: 'legacy-shared' }),
			functional('protein', 'protein', { index: 'protein-sets', origin: 'configured' }, 'protein-sets'),
			failed('expression', 'records', 'arranger-sets'),
		]);

		// Then the inheriting catalogue's peers are the other catalogues that could share the index
		assert.deepEqual(peerIdsOf(groups, 'correlation'), ['expression', 'mutation']);
		// And a catalogue naming its own index has no peer, since the failed one's config implies a different index
		assert.deepEqual(peerIdsOf(groups, 'protein'), []);
	});

	test('gives a catalogue with its own default index no peers, and a catalogue naming the same index one', () => {
		const groups = groupSetsIndexes([
			functional('donor', 'donor', { index: 'arranger-sets-donor', origin: 'default' }),
			functional('study', 'study', { index: 'shared-sets', origin: 'configured' }, 'shared-sets'),
			functional('file', 'file', { index: 'shared-sets', origin: 'configured' }, 'shared-sets'),
		]);

		assert.deepEqual(peerIdsOf(groups, 'donor'), []);
		assert.deepEqual(peerIdsOf(groups, 'study'), ['file']);
	});

	test('gives a catalogue that did not load, or has no resolution, no peers, and reports each peer documentType', () => {
		const groups = groupSetsIndexes([
			failed('expression', 'records', 'arranger-sets-expression'),
			{
				catalogueId: 'mutation',
				derivedIndex: 'arranger-sets-mutation',
				documentType: 'records',
				legacyName: 'arranger-sets',
				loaded: true,
			},
		]);

		assert.deepEqual(groups.expression, []);
		assert.deepEqual(groups.mutation, []);
	});

	test('reports each peer with its documentType, for a catalogue that failed to load', () => {
		const groups = groupSetsIndexes([
			functional('correlation', 'records', { index: 'arranger-sets', origin: 'legacy-shared' }),
			failed('expression', 'expression-records', 'arranger-sets'),
		]);

		assert.deepEqual(groups.correlation, [{ catalogueId: 'expression', documentType: 'expression-records' }]);
	});

	test('an uncatalogued legacy records set answers as missing in the catalogue that loaded, when four share its documentType', () => {
		// Given ES_ARRANGER_SETS_INDEX=arranger-sets, so four catalogues of documentType "records" name no sets index and
		// resolve to it, of which only correlation loaded
		const groups = groupSetsIndexes([
			functional('correlation', 'records', { index: 'arranger-sets', origin: 'legacy-shared' }),
			failed('mutation', 'records', 'arranger-sets'),
			failed('protein', 'records', 'arranger-sets'),
			failed('expression', 'records', 'arranger-sets'),
		]);
		const scope: SetsScope = {
			catalogue: 'correlation',
			documentType: 'records',
			ownIndex: false,
			peerDocumentTypes: (groups.correlation ?? []).flatMap(({ documentType }) =>
				documentType ? [documentType] : [],
			),
		};

		// When a legacy set holding no catalogue is read in correlation
		// Then it answers as missing, since the other catalogues share its documentType
		assert.equal(
			mayUseSetById({
				document: { attribution: 'unattributed', setId: SET_X, type: 'records' },
				requester: ANONYMOUS,
				scope,
				setId: SET_X,
			}),
			false,
		);
	});
});

suite('a failed catalogue as a possible sharer', () => {
	test('leaves a default-index catalogue its uncatalogued sets, where a failed peer names no index', () => {
		// Given a loaded catalogue on its own default index, and a failed catalogue naming no index, so its config
		// implies its own default name
		const groups = groupSetsIndexes([
			functional('donor', 'donor', { index: 'arranger-sets-donor', origin: 'default' }),
			failed('study', 'records', 'arranger-sets-study'),
		]);

		// When an uncatalogued donor set is read in donor
		const scope: SetsScope = {
			catalogue: 'donor',
			documentType: 'donor',
			ownIndex: true,
			peerDocumentTypes: (groups.donor ?? []).flatMap(({ documentType }) => (documentType ? [documentType] : [])),
		};

		// Then it still belongs to donor, since no peer names donor's index
		assert.deepEqual(groups.donor, []);
		assert.equal(
			mayUseSetById({
				document: { attribution: 'unattributed', setId: SET_X, type: 'donor' },
				requester: ANONYMOUS,
				scope,
				setId: SET_X,
			}),
			true,
		);
	});

	test('counts a failed catalogue whose config names the same index as a sharer', () => {
		// Given a failed catalogue whose config names donor's own index
		const groups = groupSetsIndexes([
			functional('donor', 'donor', { index: 'arranger-sets-donor', origin: 'default' }),
			failed('records', 'records', 'arranger-sets-donor'),
		]);

		// Then it is a peer of donor, with its documentType
		assert.deepEqual(groups.donor, [{ catalogueId: 'records', documentType: 'records' }]);
	});
});

suite('planSetsIndexes', () => {
	/** An engine holding the given data indices, each answering its mapping, recording every call by index. */
	const planningEngine = ({ dataIndices, setsIndices = [] }: { dataIndices: string[]; setsIndices?: string[] }) => {
		const calls: string[] = [];
		const esClient = {
			cat: { aliases: async () => ({ body: [] }) },
			indices: {
				create: async ({ index }: { index: string }) => {
					calls.push(`create ${index}`);
					return { acknowledged: true };
				},
				exists: async ({ index }: { index: string }) => {
					calls.push(`exists ${index}`);
					return { statusCode: setsIndices.includes(index) ? 200 : 404 };
				},
				getMapping: async ({ index }: { index: string }) => {
					calls.push(`mapping ${index}`);

					if (!dataIndices.includes(index)) {
						throw Object.assign(new Error('index_not_found_exception'), { meta: { statusCode: 404 } });
					}

					return { body: { [index]: { mappings: { properties: { donor_id: { type: 'keyword' } } } } } };
				},
			},
			search: async ({ index }: { index: string }) => {
				calls.push(`search ${index}`);
				return { body: { hits: { hits: [] } } };
			},
		};

		return { calls, esClient: esClient as never };
	};

	test('makes no sets engine call for a catalogue whose data index did not load', async () => {
		// Given a catalogue whose data index cannot be read, and saved sets enabled
		const { calls, esClient } = planningEngine({ dataIndices: [] });

		// When the sets indexes are planned
		const planned = await planSetsIndexes({
			catalogues: [
				{ catalogueId: 'expression', configs: { enableSets: true, esIndex: 'expression_index' }, owned: true },
			],
			esClient,
		});

		// Then no sets index was checked, created or searched, and the catalogue has no resolution
		assert.deepEqual(
			calls.filter((call) => !call.startsWith('mapping')),
			[],
		);
		assert.equal(planned.expression?.loaded, false);
		assert.equal(planned.expression?.resolution, undefined);
	});

	test('resolves a loaded catalogue with saved sets enabled, and shares with no catalogue whose config implies its index', async () => {
		// Given two loaded catalogues inheriting nothing, both with saved sets, and one that did not load
		const { esClient } = planningEngine({ dataIndices: ['correlation_index', 'mutation_index'] });

		// When the sets indexes are planned
		const planned = await planSetsIndexes({
			catalogues: [
				{
					catalogueId: 'correlation',
					configs: { documentType: 'records', enableSets: true, esIndex: 'correlation_index' },
					owned: true,
				},
				{
					catalogueId: 'mutation',
					configs: { documentType: 'records', enableSets: true, esIndex: 'mutation_index' },
					owned: true,
				},
				{
					catalogueId: 'expression',
					configs: { documentType: 'records', enableSets: true, esIndex: 'missing' },
					owned: true,
				},
			],
			esClient,
		});

		// Then each loaded one has its own default index, and the failed one is a peer of both
		assert.deepEqual(planned.correlation?.resolution, {
			index: 'arranger-sets-correlation',
			kind: 'index',
			origin: 'default',
		});
		assert.deepEqual(planned.mutation?.resolution, {
			index: 'arranger-sets-mutation',
			kind: 'index',
			origin: 'default',
		});
		assert.equal(planned.expression?.resolution, undefined);
		assert.deepEqual(
			planned.correlation?.peers.map(({ catalogueId }) => catalogueId),
			[],
		);
	});

	test('resolves no sets index for a loaded catalogue with saved sets disabled, but still reports it loaded', async () => {
		const { calls, esClient } = planningEngine({ dataIndices: ['donor_index'] });

		const planned = await planSetsIndexes({
			catalogues: [
				{
					catalogueId: 'donor',
					configs: { documentType: 'donor', enableSets: false, esIndex: 'donor_index' },
					owned: false,
				},
			],
			esClient,
		});

		assert.equal(planned.donor?.loaded, true);
		assert.equal(planned.donor?.resolution, undefined);
		assert.deepEqual(
			calls.filter((call) => !call.startsWith('mapping')),
			[],
		);
	});
});

suite('the index 3.0 saved every catalogue in', () => {
	test('counts a catalogue with sets off and no index of its own as a sharer of a catalogue resolved to that index', async () => {
		// Given catalogue A configuring sets.index "arranger-sets", and catalogue B loaded with saved sets off, naming no index
		const esClient = {
			cat: { aliases: async () => ({ body: [] }) },
			indices: {
				exists: async () => ({ statusCode: 404 }),
				getMapping: async ({ index }: { index: string }) => ({
					body: { [index]: { mappings: { properties: { donor_id: { type: 'keyword' } } } } },
				}),
			},
		} as never;

		// When the sets indexes are planned
		const planned = await planSetsIndexes({
			catalogues: [
				{
					catalogueId: 'a',
					configs: {
						documentType: 'records',
						enableSets: true,
						esIndex: 'a_index',
						sets: { index: 'arranger-sets' },
					},
					owned: true,
				},
				{
					catalogueId: 'b',
					configs: { documentType: 'records', enableSets: false, esIndex: 'b_index' },
					owned: true,
				},
			],
			esClient,
		});

		// Then B is a possible sharer of A, and a legacy records set with no catalogue answers as missing in A
		assert.deepEqual(
			planned.a?.peers.map(({ catalogueId }) => catalogueId),
			['b'],
		);
		const scope: SetsScope = {
			catalogue: 'a',
			documentType: 'records',
			ownIndex: false,
			peerDocumentTypes: (planned.a?.peers ?? []).flatMap(({ documentType }) =>
				documentType ? [documentType] : [],
			),
		};
		assert.equal(
			mayUseSetById({
				document: { attribution: 'unattributed', setId: SET_X, type: 'records' },
				requester: ANONYMOUS,
				scope,
				setId: SET_X,
			}),
			false,
		);
	});
});
