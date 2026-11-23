import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import path from 'path';

import axios from 'axios';
import dotenv from 'dotenv';
import type { RequestHandler } from 'express';

import {
	asUisSend,
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
 * A `set_id:` filter over a real engine, under `getRequester`: a principal's set is usable by its owner alone, and
 * naming another principal's set answers exactly as naming a set that does not exist, on every read path that
 * compiles a filter (hits, aggregations, export and saveSet's own filter). Anonymous and unattributed sets stay
 * usable by any reader holding their id.
 */

dotenv.config({ path: path.resolve('../../.env.test') });

const esClient = await searchClientFromEnv();

const DOCUMENT_TYPE = 'record';
const esIndex = 'testing-set-id-filter-ownership';
const setsIndex = 'testing-set-id-filter-ownership-sets';

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
	{ category: 'w', name: 'a*b', resource: 'A' },
	{ category: 'w', name: '__missing__', resource: 'B' },
	{ category: 'w', name: 'set_id:x', resource: 'C' },
	{ category: 'w', name: 'a.b(c)[d]?+^$|', resource: 'A' },
];

const REQUESTER_HEADER = 'x-requester';
const R1 = 'subject-r1';
const R2 = 'subject-r2';

/** The category x records: p1, p3 and p6. */
const CATEGORY_X = clause('in', 'category', ['x']);
const EVERY_RESOURCE: Filter = () => clause('in', 'resource', ['A', 'B', 'C']);
const MISSING_SET_ID = 'a3a1c0de-0000-4000-8000-0000000000ff';

const keepRequester: RequestHandler = (request, response, next) => {
	const id = request.get(REQUESTER_HEADER);
	response.locals.requester = id ? { id, kind: 'principal' } : { kind: 'anonymous' };
	next();
};
const setNamed = (setId: string): Sqon => clause('in', 'setId', [setId]);

const requesterFromLocals = (context: unknown): unknown =>
	(context as { locals?: { requester?: unknown } }).locals?.requester;

const { facetsOf, graphql } = readersFor({ documentType: DOCUMENT_TYPE, facets: ['resource'], idField: 'name' });

const HITS = `query ($filters: JSON) { ${DOCUMENT_TYPE} { hits(first: 100, filters: $filters) { total edges { node { name } } } } }`;
const SAVE_SET = `mutation ($sqon: JSON!) { saveSet(type: ${DOCUMENT_TYPE}, sqon: $sqon, path: "name") { size } }`;
const SAVE_SET_WITH_ID = `mutation ($sqon: JSON!) { saveSet(type: ${DOCUMENT_TYPE}, sqon: $sqon, path: "name") { setId size } }`;

const as = (served: Served, requester?: string): Target => ({
	base: served.base,
	headers: requester ? { [REQUESTER_HEADER]: requester } : {},
});

/** A `set_id:` filter on the field a set's ids are the values of, naming `setId`. */
const setFilter = (setId: string, op = 'in'): Sqon => asUisSend(clause(op, 'name', [`set_id:${setId}`])) as Sqon;

/** A read's answer, reduced to what the reader is given: the records, the facet, the export text, the saved size. */
type Answer = {
	aggregations: unknown;
	exported: { status: number; text: string };
	hits: unknown;
	saved: unknown;
};

/**
 * What a reader is given by each read path, for a filter, in one place so each set is answered the same way on every
 * path.
 */
const answersTo = async (target: Target, filters: Sqon): Promise<Answer> => {
	const hits = (await graphql(target, HITS, { filters })).record.hits;
	const aggregations = await facetsOf(target, filters, false);
	const saved = (await graphql(target, SAVE_SET, { sqon: filters })).saveSet;
	const params = {
		fileName: '',
		files: [
			{
				columns: [{ displayName: 'Name', fieldName: 'name' }],
				documentType: DOCUMENT_TYPE,
				fileName: 'names.tsv',
				fileType: 'tsv',
				maxRows: 0,
				sqon: filters,
				valueWhenEmpty: '--',
			},
		],
	};
	const exported = await axios.post(
		`${target.base}/download`,
		new URLSearchParams({ params: JSON.stringify(params) }).toString(),
		{
			headers: { ...target.headers, 'Content-Type': 'application/x-www-form-urlencoded' },
			validateStatus: () => true,
			responseType: 'text',
		},
	);

	return {
		aggregations,
		exported: { status: exported.status, text: String(exported.data) },
		hits,
		saved: { size: saved.size },
	};
};

suite('a set_id filter under getRequester', { concurrency: false }, () => {
	const routers: Record<string, Served> = {};
	let ownSetId = '';
	let anonymousSetId = '';
	let unattributedSetId = '';

	before(async () => {
		await seedIndex({ esClient, esIndex, idField: 'name', mappings: MAPPINGS, records: RECORDS });

		routers.owned = await startRouter({
			before: [keepRequester],
			documentType: DOCUMENT_TYPE,
			esClient,
			esIndex,
			getRequester: requesterFromLocals,
			getServerSideFilter: EVERY_RESOURCE,
			setsIndex,
		});
		// No getRequester: sets have no owner, and a set_id filter keeps the engine terms lookup.
		routers.unowned = await startRouter({
			before: [keepRequester],
			documentType: DOCUMENT_TYPE,
			esClient,
			esIndex,
			getServerSideFilter: EVERY_RESOURCE,
			setsIndex,
		});

		ownSetId = (await graphql(as(routers.owned, R1), SAVE_SET_WITH_ID, { sqon: CATEGORY_X })).saveSet.setId;
		anonymousSetId = (await graphql(as(routers.owned), SAVE_SET_WITH_ID, { sqon: CATEGORY_X })).saveSet.setId;
		unattributedSetId = (await graphql(as(routers.unowned), SAVE_SET_WITH_ID, { sqon: CATEGORY_X })).saveSet.setId;
	});

	after(async () => {
		await Promise.all(Object.values(routers).map(({ close }) => close()));
		await dropIndices(esClient, esIndex, setsIndex);
	});

	test("another principal's set answers exactly as a missing id, on every read path", async () => {
		const other = await answersTo(as(routers.owned, R2), setFilter(ownSetId));
		const missing = await answersTo(as(routers.owned, R2), setFilter(MISSING_SET_ID));

		assert.deepEqual(other, missing);
		assert.equal(other.hits && (other.hits as { total: number }).total, 0);
	});

	test('the owner of a set reads its records on every read path', async () => {
		const owned = await answersTo(as(routers.owned, R1), setFilter(ownSetId));

		assert.equal((owned.hits as { total: number }).total, 3);
		assert.equal(owned.exported.status, 200);
		assert.equal(owned.exported.text.trim().split('\n').length, 4);
		assert.deepEqual(owned.saved, { size: 3 });
	});

	test('an anonymous set named by its id is usable by any reader, on every read path', async () => {
		const reader = await answersTo(as(routers.owned, R2), setFilter(anonymousSetId));

		assert.equal((reader.hits as { total: number }).total, 3);
		assert.deepEqual(reader.saved, { size: 3 });
	});

	test('an unattributed set is usable by any reader holding its id', async () => {
		const reader = await answersTo(as(routers.owned, R2), setFilter(unattributedSetId));

		assert.equal((reader.hits as { total: number }).total, 3);
	});

	test('without getRequester, a missing id answers no records, with no error', async () => {
		const missing = await answersTo(as(routers.unowned), setFilter(MISSING_SET_ID));

		assert.equal((missing.hits as { total: number }).total, 0);
		assert.deepEqual(missing.saved, { size: 0 });
	});

	test("a not-in on another principal's set excludes what a missing id excludes, on hits", async () => {
		const other = await graphql(as(routers.owned, R2), HITS, { filters: setFilter(ownSetId, 'not-in') });
		const missing = await graphql(as(routers.owned, R2), HITS, { filters: setFilter(MISSING_SET_ID, 'not-in') });

		assert.deepEqual(other, missing);
	});

	test('a set holding wildcard, missing, set reference and regex values matches exactly those records, under in and not-in', async () => {
		const TRICKY = ['a*b', '__missing__', 'set_id:x', 'a.b(c)[d]?+^$|'];
		const saved = await graphql(as(routers.owned, R1), SAVE_SET_WITH_ID, { sqon: clause('in', 'category', ['w']) });
		const namesOf = async (op) =>
			(
				await graphql(as(routers.owned, R1), HITS, { filters: setFilter(saved.saveSet.setId, op) })
			).record.hits.edges
				.map(({ node }) => node.name)
				.sort();
		const ALL_OTHER = ['p1', 'p2', 'p3', 'p6', 'p7'];

		assert.deepEqual(await namesOf('in'), [...TRICKY].sort());
		assert.deepEqual(await namesOf('not-in'), ALL_OTHER);
	});
});

/**
 * A host server filter that names a saved set, applied as the sets connection narrows a set's records: the records of
 * the named set bound what each reader is given of a set, so the filter's own set id is checked as any filter's is.
 */
suite('a server filter naming a saved set, under getRequester', { concurrency: false }, () => {
	const routers: Record<string, Served> = {};
	const serverFilter = { setId: MISSING_SET_ID };
	let unattributedSetId = '';
	let otherSetId = '';
	let ownSetId = '';

	const NARROWED = `query ($filters: JSON) { sets { hits(filters: $filters, first: 5) { edges { node { setId ids size } } } } }`;
	const narrowedSet = async (setId: string, serverSetId: string) => {
		serverFilter.setId = serverSetId;
		const { sets } = await graphql(as(routers.narrowing, R2), NARROWED, { filters: setNamed(setId) });
		const [node] = sets.hits.edges.map(
			({ node }: { node: { ids: string[]; setId: string; size: number } }) => node,
		);

		return { ids: [...(node.ids ?? [])].sort(), size: node.size };
	};

	before(async () => {
		await seedIndex({ esClient, esIndex, idField: 'name', mappings: MAPPINGS, records: RECORDS });

		routers.unowned = await startRouter({
			before: [keepRequester],
			documentType: DOCUMENT_TYPE,
			esClient,
			esIndex,
			getServerSideFilter: EVERY_RESOURCE,
			setsIndex,
		});
		routers.owned = await startRouter({
			before: [keepRequester],
			documentType: DOCUMENT_TYPE,
			esClient,
			esIndex,
			getRequester: requesterFromLocals,
			getServerSideFilter: EVERY_RESOURCE,
			setsIndex,
		});
		routers.narrowing = await startRouter({
			before: [keepRequester],
			documentType: DOCUMENT_TYPE,
			esClient,
			esIndex,
			getRequester: requesterFromLocals,
			getServerSideFilter: () => asUisSend(clause('in', 'name', [`set_id:${serverFilter.setId}`])) as Sqon,
			setsIndex,
		});

		// Unattributed: the records category x holds, p1, p3 and p6.
		unattributedSetId = (await graphql(as(routers.unowned), SAVE_SET_WITH_ID, { sqon: CATEGORY_X })).saveSet.setId;
		// Another principal's set, and the reader's own, each the records of resource A.
		const RESOURCE_A = clause('in', 'resource', ['A']);
		otherSetId = (await graphql(as(routers.owned, R1), SAVE_SET_WITH_ID, { sqon: RESOURCE_A })).saveSet.setId;
		ownSetId = (await graphql(as(routers.owned, R2), SAVE_SET_WITH_ID, { sqon: RESOURCE_A })).saveSet.setId;
	});

	after(async () => {
		await Promise.all(Object.values(routers).map(({ close }) => close()));
		await dropIndices(esClient, esIndex, setsIndex);
	});

	test("a server filter naming another principal's set narrows a set exactly as a missing id does", async () => {
		const other = await narrowedSet(unattributedSetId, otherSetId);
		const missing = await narrowedSet(unattributedSetId, MISSING_SET_ID);

		assert.deepEqual(other, missing);
		assert.deepEqual(missing, { ids: [], size: 0 });
	});

	test("a server filter naming the reader's own set narrows a set to the records they share", async () => {
		assert.deepEqual(await narrowedSet(unattributedSetId, ownSetId), { ids: ['p1'], size: 1 });
	});
});
