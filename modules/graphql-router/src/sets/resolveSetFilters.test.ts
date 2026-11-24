import assert from 'node:assert/strict';
import { mock, suite, test } from 'node:test';

import { buildQuery } from '#middleware/index.js';
import { SetsDisabledError } from '#sets/SetsDisabledError.js';

import { setFilterResolverFor } from './resolveSetFilters.js';
import type { SetsScope } from './setsAccess.js';

const SET_X = 'a3a1c0de-0000-4000-8000-000000000001';
const SET_Y = 'a3a1c0de-0000-4000-8000-000000000002';
const RECORD_IDS = ['record-1', 'record-2'];
const FIELD = 'donor.id';

const setIn = (setId: string, op = 'in') => ({ content: { fieldName: FIELD, value: [`set_id:${setId}`] }, op });

/** A search client whose sets index holds the given documents under their ids, and answers a missing id as the engine does. */
const clientHolding = (documents: Record<string, Record<string, unknown>>) => {
	const get = mock.fn(async ({ id }: { id: string }) => {
		if (!(id in documents)) {
			throw Object.assign(new Error('not found'), { meta: { statusCode: 404 } });
		}

		return { body: { _id: id, _source: documents[id], found: true } };
	});

	return { esClient: { get } as never, get };
};

const ownedBy = (userId: string, ids: string[] = RECORD_IDS) => ({
	attribution: 'principal',
	ids,
	setId: SET_X,
	userId,
});
const PRINCIPAL_R1 = { kind: 'principal', id: 'subject-r1' } as const;
const PRINCIPAL_R2 = { kind: 'principal', id: 'subject-r2' } as const;
const getRequesterAs = (requester: unknown) => () => requester as never;
// The catalogue's own index with no peers, so the fixtures' sets, which record no catalogue, belong to it.
const OWN_SCOPE: SetsScope = { catalogue: 'catalogue-a', documentType: 'donor', ownIndex: true };

const resolverWith = (
	documents: Record<string, Record<string, unknown>>,
	{
		requester = PRINCIPAL_R1 as unknown,
		enableSets = true,
		setsIndex = 'sets-index' as string | undefined,
		setsScope = OWN_SCOPE as SetsScope | undefined,
	} = {},
) => {
	const { esClient, get } = clientHolding(documents);
	const resolve = setFilterResolverFor({
		context: {},
		enableSets,
		esClient,
		getRequester: getRequesterAs(requester),
		setsIndex,
		setsScope,
	});

	return { get, resolve };
};

suite('setFilterResolverFor under getRequester', () => {
	test('resolves a set the reader owns to the ids of its fetched document', async () => {
		const { resolve } = resolverWith({ [SET_X]: ownedBy('subject-r1') });

		assert.deepEqual(await resolve(setIn(SET_X)), new Map([[SET_X, RECORD_IDS]]));
	});

	test('fetches each set id once per request, however many clauses name it, across every filter the request compiles', async () => {
		const { get, resolve } = resolverWith({ [SET_X]: ownedBy('subject-r1') });
		const filter = { content: [setIn(SET_X), { content: [setIn(SET_X, 'not-in')], op: 'and' }], op: 'and' };

		await resolve(filter);
		await resolve(filter);

		assert.equal(get.mock.callCount(), 1);
		assert.deepEqual(get.mock.calls[0]?.arguments[0], { id: SET_X, index: 'sets-index' });
	});

	test('resolves a missing set to no ids, under a negation as well', async () => {
		const { resolve } = resolverWith({});

		assert.deepEqual(await resolve(setIn(SET_X)), new Map([[SET_X, null]]));
		assert.deepEqual(await resolve(setIn(SET_X, 'not-in')), new Map([[SET_X, null]]));
	});

	test("resolves another principal's set exactly as a missing id, so the filter cannot confirm it exists", async () => {
		const { resolve: resolveAsOther } = resolverWith(
			{ [SET_X]: ownedBy('subject-r1') },
			{ requester: PRINCIPAL_R2 },
		);
		const { resolve: resolveMissing } = resolverWith({}, { requester: PRINCIPAL_R2 });

		assert.deepEqual(await resolveAsOther(setIn(SET_X)), await resolveMissing(setIn(SET_X)));
		assert.deepEqual(await resolveAsOther(setIn(SET_X)), new Map([[SET_X, null]]));
	});

	test('resolves an unattributed set and an anonymous set named by id to their ids, for any reader', async () => {
		const documents = {
			[SET_X]: { attribution: 'unattributed', ids: RECORD_IDS, setId: SET_X },
			[SET_Y]: { attribution: 'anonymous', ids: ['record-3'], setId: SET_Y },
		};
		const { resolve } = resolverWith(documents, { requester: PRINCIPAL_R2 });

		assert.deepEqual(await resolve(setIn(SET_X)), new Map([[SET_X, RECORD_IDS]]));
		assert.deepEqual(await resolve(setIn(SET_Y)), new Map([[SET_Y, ['record-3']]]));
	});

	test('finds a set named inside a group, an all, or a value after a plain first value', async () => {
		const { resolve } = resolverWith({ [SET_X]: ownedBy('subject-r1') });
		const allOfSet = {
			content: { fieldName: FIELD, value: [`set_id:${SET_X}`] },
			op: 'all',
		};
		const afterPlain = { content: { fieldName: FIELD, value: ['plain', `set_id:${SET_X}`] }, op: 'in' };

		assert.deepEqual(await resolve(allOfSet), new Map([[SET_X, RECORD_IDS]]));
		assert.deepEqual(await resolve(afterPlain), new Map([[SET_X, RECORD_IDS]]));
	});

	test('finds no set in a filter with no saved-set clause', async () => {
		const { get, resolve } = resolverWith({});
		const filter = { content: [{ content: { fieldName: FIELD, value: ['a'] }, op: 'in' }], op: 'and' };

		assert.deepEqual(await resolve(filter), new Map());
		assert.equal(get.mock.callCount(), 0);
	});

	test('rethrows an engine failure other than a missing id, rather than resolving the set as missing', async () => {
		const esClient = {
			get: async () => {
				throw Object.assign(new Error('unavailable'), { meta: { statusCode: 503 } });
			},
		};
		const resolve = setFilterResolverFor({
			context: {},
			enableSets: true,
			esClient: esClient as never,
			getRequester: getRequesterAs(PRINCIPAL_R1),
			setsIndex: 'sets-index',
			setsScope: OWN_SCOPE,
		});

		await assert.rejects(resolve(setIn(SET_X)), /unavailable/);
	});
});

suite('setFilterResolverFor without getRequester, or with saved sets disabled', () => {
	test('resolves nothing and fetches nothing, so the compiler keeps its terms lookup', async () => {
		const { esClient, get } = clientHolding({ [SET_X]: ownedBy('subject-r1') });
		const resolve = setFilterResolverFor({
			context: {},
			enableSets: true,
			esClient,
			getRequester: undefined,
			setsIndex: 'sets-index',
		});

		assert.equal(await resolve(setIn(SET_X)), undefined);
		assert.equal(get.mock.callCount(), 0);
	});

	test('resolves nothing and fetches nothing while saved sets are disabled, so SETS_DISABLED still comes first', async () => {
		const { get, resolve } = resolverWith({ [SET_X]: ownedBy('subject-r1') }, { enableSets: false });

		assert.equal(await resolve(setIn(SET_X)), undefined);
		assert.equal(get.mock.callCount(), 0);
		assert.throws(
			() => buildQuery({ caller: 'test', enableSets: false, filters: setIn(SET_X), setsIndex: 'sets-index' }),
			SetsDisabledError,
		);
	});
});

suite('setFilterResolverFor scoped to a catalogue under getRequester', () => {
	const SCOPE = {
		catalogue: 'correlation',
		documentType: 'records',
		ownIndex: false,
		peerDocumentTypes: [],
	} satisfies SetsScope;

	test('answers a set recorded in another catalogue as a missing id, so the filter names no record', async () => {
		// Given a set the reader owns, saved from another catalogue
		const { resolve } = resolverWith(
			{ [SET_X]: { ...ownedBy('subject-r1'), catalogue: 'mutation', type: 'records' } },
			{ setsScope: SCOPE },
		);

		// When a filter names it, Then it resolves to null, exactly as a missing id does
		assert.deepEqual(await resolve(setIn(SET_X)), new Map([[SET_X, null]]));
	});

	test('resolves a set recorded in this catalogue to its ids', async () => {
		const { resolve } = resolverWith(
			{ [SET_X]: { ...ownedBy('subject-r1'), catalogue: 'correlation', type: 'records' } },
			{ setsScope: SCOPE },
		);

		assert.deepEqual(await resolve(setIn(SET_X)), new Map([[SET_X, RECORD_IDS]]));
	});

	test('answers an uncatalogued set as a missing id where a peer shares its documentType', async () => {
		// Given a set recording no catalogue, of a documentType a peer also holds
		const { resolve } = resolverWith(
			{ [SET_X]: { ...ownedBy('subject-r1'), type: 'records' } },
			{ setsScope: { ...SCOPE, ownIndex: false, peerDocumentTypes: ['records'] } },
		);

		assert.deepEqual(await resolve(setIn(SET_X)), new Map([[SET_X, null]]));
	});

	test('answers an uncatalogued set as a missing id on a non-default index given no peer information', async () => {
		const { resolve } = resolverWith(
			{ [SET_X]: { ...ownedBy('subject-r1'), type: 'records' } },
			{ setsScope: { catalogue: 'correlation', documentType: 'records', ownIndex: false } },
		);

		assert.deepEqual(await resolve(setIn(SET_X)), new Map([[SET_X, null]]));
	});

	test('resolves an uncatalogued set of the catalogue own default index', async () => {
		const { resolve } = resolverWith(
			{ [SET_X]: { ...ownedBy('subject-r1'), type: 'records' } },
			{ setsScope: { catalogue: 'correlation', documentType: 'records', ownIndex: true } },
		);

		assert.deepEqual(await resolve(setIn(SET_X)), new Map([[SET_X, RECORD_IDS]]));
	});

	test('refuses to resolve under getRequester with no scope, rather than look a set up unscoped', async () => {
		const { esClient } = clientHolding({ [SET_X]: ownedBy('subject-r1') });
		const resolve = setFilterResolverFor({
			context: {},
			enableSets: true,
			esClient,
			getRequester: getRequesterAs(PRINCIPAL_R1),
			setsIndex: 'sets-index',
			setsScope: undefined,
		});

		await assert.rejects(resolve(setIn(SET_X)), /no catalogue scope/);
	});
});
