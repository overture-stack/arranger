import assert from 'node:assert/strict';
import { after, before, mock, suite, test } from 'node:test';
import { format } from 'node:util';
import path from 'path';

import axios from 'axios';
import dotenv from 'dotenv';
import type { RequestHandler } from 'express';

import {
	clause,
	dropIndices,
	type Filter,
	readersFor,
	searchClientFromEnv,
	seedIndex,
	type Served,
	type Sqon,
	startRouter,
	type Target,
} from '../harness/parity.js';

/**
 * Saved sets through the GraphQL router over a real engine: who a set belongs to, which sets a reader is listed,
 * and what of a set's contents each reader is given, under each combination of a filter callback and
 * `getRequester`. A request names its reader in a header, or that its reader is suspended, which a middleware
 * ahead of the router keeps in `res.locals` for `getRequester`, as a host's own authentication would.
 */

dotenv.config({ path: path.resolve('../../.env.test') });

const esClient = await searchClientFromEnv();

const DOCUMENT_TYPE = 'record';
const esIndex = 'testing-saved-set-access';
const setsIndex = 'testing-saved-set-access-sets';

const MAPPINGS = {
	mappings: {
		properties: { category: { type: 'keyword' }, name: { type: 'keyword' }, resource: { type: 'keyword' } },
	},
};

const RECORDS = [
	{ category: 'x', name: 'p1', resource: 'A' },
	{ category: 'y', name: 'p2', resource: 'A' },
	{ category: 'x', name: 'p3', resource: 'B' },
	{ category: 'x', name: 'p6', resource: 'C' },
	{ category: 'z', name: 'p7', resource: 'A' },
];

const REQUESTER_HEADER = 'x-requester';
const SUSPENDED_HEADER = 'x-suspended';
const R1 = 'subject-r1';
const R2 = 'subject-r2';
const R3 = 'subject-r3';

const RESOURCE_A_ONLY: Filter = () => clause('in', 'resource', ['A']);
const EVERY_RESOURCE: Filter = () => clause('in', 'resource', ['A', 'B', 'C']);

const keepRequester: RequestHandler = (request, response, next) => {
	const id = request.get(REQUESTER_HEADER);
	response.locals.requester = request.get(SUSPENDED_HEADER)
		? { kind: 'suspended', retryAfterSeconds: 7 }
		: id
			? { id, kind: 'principal' }
			: { kind: 'anonymous' };
	next();
};
const requesterFromLocals = (context: unknown): unknown =>
	(context as { locals?: { requester?: unknown } }).locals?.requester;

const { graphql } = readersFor({ documentType: DOCUMENT_TYPE, facets: [], idField: 'name' });

/** The category x records, p1 of resource A beside p3 of B and p6 of C. */
const CATEGORY_X = clause('in', 'category', ['x']);

const SAVE_SET = `mutation ($sqon: JSON!, $userId: String) { saveSet(type: ${DOCUMENT_TYPE}, sqon: $sqon, path: "name", userId: $userId) { setId size userId } }`;
const LIST_SETS = `query ($filters: JSON, $first: Int, $offset: Int) { sets { hits(filters: $filters, first: $first, offset: $offset) { total edges { node { attribution setId ids size sqon userId } } } } }`;
const COUNT_SETS_BY_ATTRIBUTION = `query ($filters: JSON) { sets { aggregations(filters: $filters) { attribution { buckets { key doc_count } } } } }`;

type SetNode = {
	attribution: string | null;
	ids: string[] | null;
	setId: string;
	size: number | null;
	sqon: unknown;
	userId: string | null;
};

/** Whether a listed set is one every reader may be listed: unattributed, or carrying no mark. */
const isUnowned = ({ attribution }: SetNode): boolean => attribution === 'unattributed' || attribution === null;

/** How many sets the sets index holds, once every write is visible. */
const storedSetCount = async (): Promise<number> => {
	await esClient.indices.refresh({ index: setsIndex });
	const { body } = await esClient.search({ body: { size: 0, track_total_hits: true }, index: setsIndex });
	const { total } = body.hits;

	return typeof total === 'number' ? total : total.value;
};

const as = (served: Served, requester?: string): Target => ({
	base: served.base,
	headers: requester ? { [REQUESTER_HEADER]: requester } : {},
});

const suspendedAt = (served: Served): Target => ({ base: served.base, headers: { [SUSPENDED_HEADER]: '1' } });

const saveSetAs = async (
	target: Target,
	sqon: Sqon,
	userId?: string,
): Promise<{ setId: string; size: number; userId: string | null }> =>
	(await graphql(target, SAVE_SET, { sqon, userId })).saveSet;

const listSets = async (
	target: Target,
	variables: { filters?: Sqon; first?: number; offset?: number } = {},
): Promise<{ nodes: SetNode[]; total: number }> => {
	const { hits } = (await graphql(target, LIST_SETS, variables)).sets;

	return { nodes: hits.edges.map(({ node }: { node: SetNode }) => node), total: hits.total };
};

const setNamed = (setId: string): Sqon => clause('in', 'setId', [setId]);

/** The one set `target` is given when it names `setId`, failing the test where it is given anything else. */
const fetchSet = async (target: Target, setId: string): Promise<SetNode> => {
	const { nodes } = await listSets(target, { filters: setNamed(setId) });
	assert.equal(nodes.length, 1, `expected the named set alone, got ${JSON.stringify(nodes)}`);

	return nodes[0] as SetNode;
};

/** The set as the sets index stores it, read from the index itself, as an operator would. */
const storedSet = async (setId: string): Promise<Record<string, unknown>> => {
	const { body } = await esClient.search({ body: { query: { ids: { values: [setId] } } }, index: setsIndex });
	const [hit] = body.hits.hits;
	assert.ok(hit, `the sets index holds no set ${setId}`);

	return hit._source;
};

const sorted = (values: readonly string[] | null): string[] | null => (values === null ? null : [...values].sort());

/** The sets a target is listed when it names `setId`: for another principal's set, none, as for a set that does not exist. */
const namedBy = async (target: Target, setId: string): Promise<SetNode[]> =>
	(await listSets(target, { filters: setNamed(setId) })).nodes;

const MISSING_SET_ID = 'a3a1c0de-0000-4000-8000-0000000000ff';

suite('saved sets', { concurrency: false }, () => {
	const routers: Record<string, Served> = {};
	const startupLines: string[] = [];

	before(async () => {
		await seedIndex({ esClient, esIndex, idField: 'name', mappings: MAPPINGS, records: RECORDS });

		const start = (getServerSideFilter?: Filter, getRequester?: (context: unknown) => unknown) =>
			startRouter({
				before: [keepRequester],
				documentType: DOCUMENT_TYPE,
				esClient,
				esIndex,
				...(getRequester && { getRequester }),
				...(getServerSideFilter && { getServerSideFilter }),
				setsIndex,
			});

		routers.open = await start();
		routers.everyResource = await start(EVERY_RESOURCE, requesterFromLocals);
		routers.resourceA = await start(RESOURCE_A_ONLY, requesterFromLocals);
		routers.ownedOnly = await start(undefined, requesterFromLocals);

		const infos = mock.method(console, 'info', (...args: unknown[]) => {
			startupLines.push(format(...args));
		});
		try {
			routers.noRequesterId = await start(RESOURCE_A_ONLY);
		} finally {
			infos.mock.restore();
		}
	});

	after(async () => {
		await Promise.all(Object.values(routers).map(({ close }) => close()));
		await dropIndices(esClient, esIndex, setsIndex);
	});

	test("records the requester as a set's creator, whatever userId the client sends, and answers no userId", async () => {
		// Given a reader saving a set and naming someone else as its creator
		const saved = await saveSetAs(as(routers.everyResource, R1), CATEGORY_X, 'someone-else');

		// Then the index stores the set as the requester's, marked as saved by a principal, and the save answers no
		// userId
		const stored = await storedSet(saved.setId);
		assert.equal(saved.userId, null);
		assert.deepEqual(
			{ attribution: stored.attribution, userId: stored.userId },
			{ attribution: 'principal', userId: R1 },
		);
	});

	test("lists a reader their own sets and the sets with no owner, never another reader's or an anonymous set", async () => {
		// Given two sets saved by one reader, one by another, and one saved anonymously
		const own = [
			await saveSetAs(as(routers.everyResource, R2), CATEGORY_X),
			await saveSetAs(as(routers.everyResource, R2), clause('in', 'resource', ['A'])),
		];
		const others = await saveSetAs(as(routers.everyResource, R3), CATEGORY_X);
		const anonymous = await saveSetAs(as(routers.everyResource), CATEGORY_X);

		// When the first reader lists sets
		const listed = await listSets(as(routers.everyResource, R2), { first: 20 });
		const listedIds = listed.nodes.map(({ setId }) => setId);
		const listedOwned = await Promise.all(
			listed.nodes.filter(({ attribution }) => attribution === 'principal').map(({ setId }) => storedSet(setId)),
		);

		// Then they are listed their own sets, and besides those only sets with no owner, never the other reader's or
		// the anonymous one
		assert.ok(
			own.every(({ setId }) => listedIds.includes(setId)),
			JSON.stringify(listedIds),
		);
		assert.ok(!listedIds.includes(others.setId));
		assert.ok(!listedIds.includes(anonymous.setId));
		assert.ok(
			listed.nodes.every((node) => node.attribution === 'principal' || isUnowned(node)),
			JSON.stringify(listed.nodes),
		);
		assert.ok(
			listedOwned.every(({ userId }) => userId === R2),
			JSON.stringify(listedOwned),
		);
	});

	test("answers another reader's set named by its id exactly as a missing id, for a reader granted resource A alone", async () => {
		// Given a set of every resource's category x records, saved by one reader
		const { setId } = await saveSetAs(as(routers.everyResource, R1), CATEGORY_X);

		// When a reader granted resource A alone names that set by its id, and a set that does not exist
		const named = await namedBy(as(routers.resourceA, R2), setId);
		const missing = await namedBy(as(routers.resourceA, R2), MISSING_SET_ID);

		// Then the other reader is given nothing, as for the missing id
		assert.deepEqual(named, []);
		assert.deepEqual(named, missing);
	});

	test("gives the creator their own set's stored filter and no creator, its ids checked against their own access", async () => {
		// Given a set of every resource's category x records, saved by one reader, and that set as a router with no
		// filter callback returns it
		const { setId } = await saveSetAs(as(routers.everyResource, R1), CATEGORY_X);
		const stored = await fetchSet(as(routers.open), setId);
		assert.notEqual(stored.sqon, null, 'the set holds no filter, so it tests nothing');

		// When the creator fetches it with every resource granted, then with resource A alone
		const whole = await fetchSet(as(routers.everyResource, R1), setId);
		const narrowed = await fetchSet(as(routers.resourceA, R1), setId);

		// Then both carry its stored filter and no creator, and its ids are whole, then resource A's alone
		assert.deepEqual(
			{ ...whole, ids: sorted(whole.ids) },
			{ attribution: 'principal', ids: ['p1', 'p3', 'p6'], setId, size: 3, sqon: stored.sqon, userId: null },
		);
		assert.deepEqual(
			{ ...narrowed, ids: sorted(narrowed.ids) },
			{ attribution: 'principal', ids: ['p1'], setId, size: 1, sqon: stored.sqon, userId: null },
		);
	});

	test("pages a reader's own sets at most 20 at a time, the rest reachable by offset", async () => {
		// Given a reader holding 22 sets of their own
		const pager = 'subject-pager';
		await Promise.all(Array.from({ length: 22 }, () => saveSetAs(as(routers.everyResource, pager), CATEGORY_X)));

		// When they ask for 50 of the sets a principal saved, which are their own, then for what follows the first 20
		const ownOnly = clause('in', 'attribution', ['principal']);
		const first = await listSets(as(routers.everyResource, pager), { filters: ownOnly, first: 50 });
		const rest = await listSets(as(routers.everyResource, pager), { filters: ownOnly, first: 50, offset: 20 });

		// Then a page holds 20, the total counts all 22, and the next page holds the other two
		assert.equal(first.nodes.length, 20);
		assert.equal(first.total, 22);
		assert.equal(rest.nodes.length, 2);
		assert.equal(new Set([...first.nodes, ...rest.nodes].map(({ setId }) => setId)).size, 22);
	});

	test("counts a reader's own sets, and none of another reader's, in the sets aggregations", async () => {
		// Given sets saved by two readers
		const counter = 'subject-counter';
		await saveSetAs(as(routers.everyResource, counter), CATEGORY_X);
		await saveSetAs(as(routers.everyResource, R3), CATEGORY_X);

		// When one of them counts sets by how they were saved
		const { aggregations } = (await graphql(as(routers.everyResource, counter), COUNT_SETS_BY_ATTRIBUTION, {}))
			.sets;

		// Then the sets a principal saved that they count are their own one alone
		const buckets: { doc_count: number; key: string }[] = aggregations.attribution.buckets;
		assert.deepEqual(
			buckets.filter(({ key }) => key === 'principal'),
			[{ doc_count: 1, key: 'principal' }],
		);
	});

	test("gives an anonymous request's set no creator, lists it to no one, and serves it by its id with its filter, narrowed per reader", async () => {
		// Given a set saved anonymously, naming a creator of its own
		const anonymousSet = await saveSetAs(as(routers.everyResource), CATEGORY_X, 'claimed-creator');

		// When an anonymous request and a reader list sets, and a reader granted resource A alone fetches it by its id
		const listedAnonymously = await listSets(as(routers.everyResource), { first: 20 });
		const listedToReader = await listSets(as(routers.everyResource, R1), { first: 20 });
		const fetched = await fetchSet(as(routers.resourceA, R2), anonymousSet.setId);

		// Then it has no creator and is marked anonymous, neither is listed it, and the reader is given its filter and
		// resource A's record
		assert.equal(anonymousSet.userId, null);
		assert.ok(!listedAnonymously.nodes.some(({ setId }) => setId === anonymousSet.setId));
		assert.ok(!listedToReader.nodes.some(({ setId }) => setId === anonymousSet.setId));
		assert.notEqual(fetched.sqon, null);
		assert.deepEqual(
			{
				attribution: fetched.attribution,
				ids: sorted(fetched.ids),
				setId: fetched.setId,
				size: fetched.size,
				userId: fetched.userId,
			},
			{ attribution: 'anonymous', ids: ['p1'], setId: anonymousSet.setId, size: 1, userId: null },
		);
	});

	test("lists an anonymous request only sets with no owner, and answers a reader's set named by id as a missing id", async () => {
		// Given a set saved by a reader
		const { setId } = await saveSetAs(as(routers.everyResource, R1), CATEGORY_X);

		// When an anonymous request lists sets, and names that set by its id
		const listed = await listSets(as(routers.everyResource), { first: 20 });
		const named = await namedBy(as(routers.resourceA), setId);
		const missing = await namedBy(as(routers.resourceA), MISSING_SET_ID);

		// Then it is listed only sets with no owner, and the named set is answered as the missing id is
		assert.ok(listed.nodes.every(isUnowned), JSON.stringify(listed.nodes));
		assert.deepEqual(named, []);
		assert.deepEqual(named, missing);
	});

	test('reads a set saved before marks were recorded as unattributed: listed to every reader, with its filter, narrowed', async () => {
		// Given a set stored with no mark, as one saved before marks were recorded is
		const setId = 'a3a1c0de-0000-4000-8000-0000000000bb';
		await esClient.index({
			body: {
				ids: ['p1', 'p3', 'p6'],
				path: 'name',
				setId,
				size: 3,
				sqon: CATEGORY_X,
				type: DOCUMENT_TYPE,
				userId: R3,
			},
			id: setId,
			index: setsIndex,
			refresh: true,
		});

		// When a reader with every resource lists sets, and a reader granted resource A alone fetches it
		const listed = await listSets(as(routers.everyResource, R1), { first: 20 });
		const fetched = await fetchSet(as(routers.resourceA, R2), setId);

		// Then it is listed to the first, and the second is given its filter and resource A's record, and no creator
		assert.ok(
			listed.nodes.some((node) => node.setId === setId),
			JSON.stringify(listed.nodes),
		);
		assert.deepEqual(
			{ ids: sorted(fetched.ids), sqon: fetched.sqon, userId: fetched.userId },
			{ ids: ['p1'], sqon: CATEGORY_X, userId: null },
		);
	});

	test("gives no ids and no size for a set whose type is no catalogue's, even to its creator", async () => {
		// Given a set stored for a type this router serves no catalogue of
		const setId = 'a3a1c0de-0000-4000-8000-0000000000aa';
		await esClient.index({
			body: { ids: ['p1'], path: 'name', setId, size: 1, sqon: null, type: 'unknown-type', userId: R1 },
			id: setId,
			index: setsIndex,
			refresh: true,
		});

		// When its creator fetches it
		const fetched = await fetchSet(as(routers.resourceA, R1), setId);

		// Then nothing of its contents is given
		assert.deepEqual({ ids: fetched.ids, size: fetched.size }, { ids: null, size: null });
	});

	suite('a suspended requester', () => {
		test('is refused saving a set, as access unavailable, and the sets index is unchanged', async () => {
			// Given the sets the index holds
			const before = await storedSetCount();

			// When a suspended requester saves a set
			const { data } = await axios.post(
				`${routers.everyResource.base}/graphql`,
				{ query: SAVE_SET, variables: { sqon: CATEGORY_X } },
				{ headers: suspendedAt(routers.everyResource).headers },
			);

			// Then the save is refused as access unavailable, no set is returned, and the index holds no more sets
			assert.deepEqual(
				data.errors?.map(({ extensions }: { extensions?: { code?: string } }) => extensions?.code),
				['ACCESS_ENFORCEMENT_UNAVAILABLE'],
			);
			assert.equal(data.data?.saveSet ?? null, null);
			assert.equal(await storedSetCount(), before);
		});

		test('reads saved sets as an anonymous request does', async () => {
			// Given a set saved anonymously and one saved by a reader
			const anonymousSet = await saveSetAs(as(routers.everyResource), CATEGORY_X);
			const { setId } = await saveSetAs(as(routers.everyResource, R1), CATEGORY_X);

			// When a suspended requester lists sets, and fetches each set by its id
			const listed = await listSets(suspendedAt(routers.everyResource), { first: 20 });
			const anonymousFetched = await fetchSet(suspendedAt(routers.everyResource), anonymousSet.setId);
			const readerNamed = await namedBy(suspendedAt(routers.everyResource), setId);
			const readerMissing = await namedBy(suspendedAt(routers.everyResource), MISSING_SET_ID);

			// Then it is listed only sets with no owner, is given the anonymous set's filter, and the reader's set
			// answers as a missing id does
			assert.ok(listed.nodes.every(isUnowned), JSON.stringify(listed.nodes));
			assert.notEqual(anonymousFetched.sqon, null);
			assert.deepEqual(readerNamed, []);
			assert.deepEqual(readerNamed, readerMissing);
		});
	});

	suite('a filter callback with no getRequester', () => {
		test('logs at startup, naming getRequester, that saved sets have no owner', () => {
			assert.equal(
				startupLines.filter((line) => line.includes('sets.unowned') && line.includes('getRequester')).length,
				1,
				JSON.stringify(startupLines),
			);
		});

		test("stores the userId a client sends, lists every set with its filter, and narrows each set's records", async () => {
			// Given a set saved there naming its creator, and one saved by a reader elsewhere
			const saved = await saveSetAs(as(routers.noRequesterId, R1), CATEGORY_X, 'client-named');
			const elsewhere = await saveSetAs(as(routers.everyResource, R2), CATEGORY_X);

			// When a reader lists sets there, and fetches the other set by its id
			const listed = await listSets(as(routers.noRequesterId, R1), { first: 20 });
			const fetched = await fetchSet(as(routers.noRequesterId, R1), elsewhere.setId);

			// Then the index stores the creator the client named and none is answered, both are listed, and the other
			// set comes with its filter, its records narrowed to resource A
			assert.equal((await storedSet(saved.setId)).userId, 'client-named');
			assert.equal(saved.userId, null);
			assert.ok(listed.total >= 2, JSON.stringify(listed.total));
			assert.notEqual(fetched.sqon, null);
			assert.deepEqual(
				{ ids: sorted(fetched.ids), setId: fetched.setId, size: fetched.size, userId: fetched.userId },
				{ ids: ['p1'], setId: elsewhere.setId, size: 1, userId: null },
			);
		});
	});

	suite('a set saved where no getRequester is given', () => {
		test('is listed to every reader of a router with getRequester, with its filter, the userId the client sent stored as data', async () => {
			// Given a set saved by a router with no getRequester, naming its creator
			const { setId } = await saveSetAs(as(routers.noRequesterId, R1), CATEGORY_X, 'client-named');

			// When a reader of a router with getRequester lists sets
			const listed = await listSets(as(routers.everyResource, R2), { first: 100 });
			const node = listed.nodes.find((candidate) => candidate.setId === setId);

			// Then it is listed, marked unattributed, with its filter and no userId, the one the client sent stored
			assert.notEqual(node?.sqon ?? null, null);
			assert.deepEqual(
				{ attribution: node?.attribution, userId: node?.userId },
				{ attribution: 'unattributed', userId: null },
			);
			assert.equal((await storedSet(setId)).userId, 'client-named');
		});
	});

	suite('getRequester with no filter callback', () => {
		test("records the requester as a set's creator, keeps it from another reader's listing and from a set named by id, and serves its owner its records whole", async () => {
			// Given a set saved by one reader
			const saved = await saveSetAs(as(routers.ownedOnly, R1), CATEGORY_X, 'someone-else');

			// When another reader lists sets, names it by its id, and the owner fetches it by its id
			const listed = await listSets(as(routers.ownedOnly, R2), { first: 20 });
			const named = await namedBy(as(routers.ownedOnly, R2), saved.setId);
			const missing = await namedBy(as(routers.ownedOnly, R2), MISSING_SET_ID);
			const fetched = await fetchSet(as(routers.ownedOnly, R1), saved.setId);

			// Then it is stored as the first reader's, the other is not listed it nor given it by id, as for a missing
			// id, and the owner is given its records whole with its filter and no creator
			assert.equal((await storedSet(saved.setId)).userId, R1);
			assert.ok(!listed.nodes.some(({ setId }) => setId === saved.setId));
			assert.deepEqual(named, []);
			assert.deepEqual(named, missing);
			assert.deepEqual(
				{ ...fetched, ids: sorted(fetched.ids) },
				{
					attribution: 'principal',
					ids: ['p1', 'p3', 'p6'],
					setId: saved.setId,
					size: 3,
					sqon: CATEGORY_X,
					userId: null,
				},
			);
		});
	});

	suite('a router with no filter callback', () => {
		test('stores the userId a client sends, lists every set, and gives each whole with its filter and no creator', async () => {
			// Given a set saved with no filter callback, naming its creator
			const { setId } = await saveSetAs(as(routers.open), CATEGORY_X, 'client-named');

			// When every set is listed
			const listed = await listSets(as(routers.open), { first: 100 });
			const node = listed.nodes.find((candidate) => candidate.setId === setId);

			// Then it is listed beside the others, whole, with its filter and no creator, the one the client named stored
			assert.ok(listed.total > 1, JSON.stringify(listed.total));
			assert.notEqual(node?.sqon ?? null, null);
			assert.deepEqual(
				{ ids: sorted(node?.ids ?? null), setId: node?.setId, size: node?.size, userId: node?.userId },
				{ ids: ['p1', 'p3', 'p6'], setId, size: 3, userId: null },
			);
			assert.equal((await storedSet(setId)).userId, 'client-named');
		});
	});

	suite('a field a reader is not given as stored', () => {
		const FILTERED = 'query ($filters: JSON) { sets { hits(filters: $filters) { total } } }';
		const SORTED = 'query ($sort: [Sort]) { sets { hits(sort: $sort) { total } } }';
		const AGGREGATIONS_OF: Record<string, string> = {
			attribution: 'attribution { buckets { key } }',
			ids: 'ids { buckets { key } }',
			size: 'size { stats { max } }',
			sqon: 'sqon { buckets { key } }',
			userId: 'userId { buckets { key } }',
		};

		/** The whole answer to a query, errors included. */
		const answerTo = async (target: Target, query: string, variables: Record<string, unknown> = {}) =>
			(await axios.post(`${target.base}/graphql`, { query, variables }, { headers: target.headers })).data;

		const assertRefused = (answer: {
			data?: unknown;
			errors?: { extensions?: { code?: string }; message: string }[];
		}) => {
			assert.deepEqual(
				answer.errors?.map(({ extensions }) => extensions?.code),
				['BAD_USER_INPUT'],
				JSON.stringify(answer),
			);
			assert.match(answer.errors?.[0]?.message ?? '', /^The sets connection can be (filtered|sorted) only by /);
		};

		for (const [description, router, withheld] of [
			['a router with neither a filter callback nor getRequester', 'open', ['userId']],
			['a filter callback alone', 'noRequesterId', ['ids', 'size', 'userId']],
			['getRequester alone', 'ownedOnly', ['sqon', 'userId']],
			['a filter callback and getRequester', 'resourceA', ['ids', 'size', 'sqon', 'userId']],
		] as const) {
			for (const fieldName of withheld) {
				test(`refuses filtering sets by ${fieldName} under ${description}`, async () => {
					assertRefused(
						await answerTo(as(routers[router] as Served, R1), FILTERED, {
							filters: clause('in', fieldName, ['p1']),
						}),
					);
				});

				test(`refuses sorting sets by ${fieldName} under ${description}`, async () => {
					assertRefused(
						await answerTo(as(routers[router] as Served, R1), SORTED, {
							sort: [{ fieldName, order: 'asc' }],
						}),
					);
				});
			}

			test(`answers an aggregation on ${withheld.join(', ')} as null under ${description}, and on attribution as stored`, async () => {
				// Given a set saved there
				await saveSetAs(as(routers[router] as Served, R1), CATEGORY_X);

				// When the withheld fields are aggregated beside attribution
				const answer = await answerTo(
					as(routers[router] as Served, R1),
					`query { sets { aggregations { ${['attribution', ...withheld].map((fieldName) => AGGREGATIONS_OF[fieldName]).join(' ')} } } }`,
				);

				// Then each withheld field answers null, and attribution its buckets
				assert.equal(answer.errors, undefined, JSON.stringify(answer.errors));
				const { attribution, ...withheldAnswers } = answer.data.sets.aggregations;
				assert.deepEqual(withheldAnswers, Object.fromEntries(withheld.map((fieldName) => [fieldName, null])));
				assert.ok(attribution.buckets.length > 0, JSON.stringify(attribution));
			});
		}

		for (const [description, router] of [
			['without getRequester', 'open'],
			['with getRequester', 'ownedOnly'],
		] as const) {
			test(`refuses filtering sets by a path within sqon, which the sets index stores and never indexes, ${description}`, async () => {
				assertRefused(
					await answerTo(as(routers[router] as Served, R1), FILTERED, {
						filters: clause('in', 'sqon.op', ['and']),
					}),
				);
			});

			test(`refuses sorting sets by sqon, which the sets index stores and never indexes, ${description}`, async () => {
				assertRefused(
					await answerTo(as(routers[router] as Served, R1), SORTED, {
						sort: [{ fieldName: 'sqon', order: 'asc' }],
					}),
				);
			});
		}

		test('refuses a filter naming the fields it searches by a pattern', async () => {
			assertRefused(
				await answerTo(as(routers.open), FILTERED, {
					filters: { content: { fieldNames: ['*'], value: 'p1' }, op: 'filter' },
				}),
			);
		});

		test('lets a router with no filter callback filter and sort sets by ids and size, as every reader is given them as stored', async () => {
			// Given a set holding p1, saved with no filter callback
			const { setId } = await saveSetAs(as(routers.open), CATEGORY_X);

			// When its sets are filtered by ids and sorted by size
			const { nodes } = await listSets(as(routers.open), {
				filters: { content: [setNamed(setId), clause('in', 'ids', ['p1'])], op: 'and' },
			});
			const answer = await answerTo(as(routers.open), SORTED, { sort: [{ fieldName: 'size', order: 'desc' }] });

			// Then the set is found, and the sort answers
			assert.deepEqual(
				nodes.map((node) => node.setId),
				[setId],
			);
			assert.equal(answer.errors, undefined, JSON.stringify(answer.errors));
		});

		test('lets every router filter and sort sets by the fields every reader is given as stored', async () => {
			// Given a set saved under a filter callback and getRequester
			const { setId } = await saveSetAs(as(routers.resourceA, R1), CATEGORY_X);

			// When its creator filters sets by setId, type, path and attribution, sorted by createdAt
			const answer = await answerTo(
				as(routers.resourceA, R1),
				'query ($filters: JSON, $sort: [Sort]) { sets { hits(filters: $filters, sort: $sort) { edges { node { setId } } } } }',
				{
					filters: {
						content: [
							setNamed(setId),
							clause('in', 'type', [DOCUMENT_TYPE]),
							clause('in', 'path', ['name']),
							clause('in', 'attribution', ['principal']),
						],
						op: 'and',
					},
					sort: [{ fieldName: 'createdAt', order: 'desc' }],
				},
			);

			// Then the set is found
			assert.equal(answer.errors, undefined, JSON.stringify(answer.errors));
			assert.deepEqual(
				answer.data.sets.hits.edges.map(({ node }: { node: { setId: string } }) => node.setId),
				[setId],
			);
		});
	});
});
