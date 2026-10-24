import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import includeEverything from '#accessControl/includeEverything.js';
import { restrictingFilter } from '#accessControl/serverSideFilters.fixture.js';
import type { SearchClient } from '#searchClient/index.js';

import { narrowSetForReader } from './narrowSet.js';

type Document = { _id: string; _source: Record<string, unknown> };
type EngineRequest = { body: Record<string, any>; index: string; size?: number };

const DOCUMENTS: Document[] = [
	{ _id: 'p1', _source: { name: 'p1', resource: 'A' } },
	{ _id: 'p2', _source: { name: 'p2', resource: 'A' } },
	{ _id: 'p3', _source: { name: 'p3', resource: 'B' } },
	{ _id: 'p6', _source: { name: 'p6', resource: 'C' } },
	{ _id: 'p7', _source: { name: 'p7', resource: 'A' } },
];

const RESOURCE_A = restrictingFilter({ fieldName: 'resource', values: ['A'] })(undefined);

const valuesOf = (document: Document, fieldName: string): unknown[] =>
	fieldName === '_id' ? [document._id] : [document._source[fieldName]].flat();

const asList = (clauses: unknown): Record<string, any>[] =>
	clauses === undefined ? [] : ([clauses].flat() as Record<string, any>[]);

/** Whether `document` meets `clause`, for the `terms` and `bool` clauses the narrowing sends and compiles. */
const matches = (document: Document, clause: Record<string, any>): boolean => {
	if (clause.terms) {
		const [fieldName, values] = Object.entries(clause.terms).find(([key]) => key !== 'boost') as [
			string,
			unknown[],
		];
		return valuesOf(document, fieldName).some((value) => values.includes(value));
	}

	if (clause.bool) {
		const { filter, must, must_not: mustNot, should } = clause.bool;
		return (
			[...asList(filter), ...asList(must)].every((child) => matches(document, child)) &&
			!asList(mustNot).some((child) => matches(document, child)) &&
			(asList(should).length === 0 || asList(should).some((child) => matches(document, child)))
		);
	}

	throw new Error(`The stand-in engine does not evaluate ${JSON.stringify(clause)}`);
};

/** A search engine over DOCUMENTS, answering every search exactly unless told a shard failed, and recording each. */
const createEngine = ({ failedShards = 0 }: { failedShards?: number } = {}) => {
	const searches: EngineRequest[] = [];
	const client = {
		search: async (request: EngineRequest) => {
			searches.push(request);
			const matching = DOCUMENTS.filter((document) => matches(document, request.body.query));
			const aggregations = Object.fromEntries(
				Object.entries(request.body.aggs ?? {}).map(([name, aggregation]) => [
					name,
					{ doc_count: matching.filter((document) => matches(document, (aggregation as any).filter)).length },
				]),
			);

			return {
				body: {
					_shards: { failed: failedShards, successful: 2 - failedShards, total: 2 },
					aggregations,
					hits: {
						hits: matching.slice(0, request.body.size ?? request.size ?? 10),
						total: { relation: 'eq', value: matching.length },
					},
					timed_out: false,
				},
			};
		},
	} as unknown as SearchClient;

	return { client, searches };
};

/** The narrowing of `ids`, saved at `path`, for a reader under `serverSideFilter`. */
const narrow = ({
	chunkSize,
	engine = createEngine(),
	ids,
	nestedFieldNames = [],
	path = 'name',
	serverSideFilter = RESOURCE_A,
}: {
	chunkSize?: number;
	engine?: ReturnType<typeof createEngine>;
	ids: string[];
	nestedFieldNames?: string[];
	path?: string;
	serverSideFilter?: unknown;
}) =>
	narrowSetForReader({
		catalogue: 'record',
		...(chunkSize !== undefined && { chunkSize }),
		esClient: engine.client,
		index: 'record_index',
		legacyDateFieldNames: [],
		nestedFieldNames,
		nestingPrefix: undefined,
		serverSideFilter: serverSideFilter as never,
		set: { ids, path, size: ids.length },
		setsIndex: 'record_sets',
	});

/** The values each search named in its own `terms` clause on `fieldName`. */
const termsSentOn = (searches: EngineRequest[], fieldName: string): unknown[][] =>
	searches.map((search) => {
		const ownClause = search.body.query.terms ?? asList(search.body.query.bool?.filter)[0]?.terms;
		return ownClause[fieldName];
	});

suite('narrowSetForReader', () => {
	test('serves a set whole, asking the engine nothing, under a filter restricting no record', async () => {
		// Given a reader whose filter restricts no record
		const engine = createEngine();

		// When a set holding records of every resource is narrowed for them
		const narrowed = await narrow({
			engine,
			ids: ['p3', 'p1', 'p6'],
			serverSideFilter: includeEverything(undefined),
		});

		// Then it is served as stored, with no search
		assert.deepEqual(narrowed, { ids: ['p3', 'p1', 'p6'], size: 3 });
		assert.deepEqual(engine.searches, []);
	});

	test('serves a set whole when every record it holds is one the reader may see', async () => {
		assert.deepEqual(await narrow({ ids: ['p2', 'p1'] }), { ids: ['p2', 'p1'], size: 2 });
	});

	test("serves only the records the reader may see, in the set's own order, when it holds others", async () => {
		// Given a reader granted resource A, and a set holding A's p1 and p2 among records of B and C
		// When it is narrowed for them, Then its ids are A's alone, in the order stored, and its size counts them
		assert.deepEqual(await narrow({ ids: ['p3', 'p2', 'p6', 'p1'] }), { ids: ['p2', 'p1'], size: 2 });
	});

	test('serves a stored id that no record holds, since it names no record the reader could be shown', async () => {
		assert.deepEqual(await narrow({ ids: ['p1', 'gone'] }), { ids: ['p1', 'gone'], size: 2 });
	});

	test('checks a set of any size in chunks of at most the chunk size, fetching ids only for a chunk that differs', async () => {
		// Given a set of five records whose last chunk holds one the reader may not see
		const engine = createEngine();

		// When it is narrowed in chunks of two
		const narrowed = await narrow({ chunkSize: 2, engine, ids: ['p1', 'p2', 'p7', 'gone', 'p3'] });

		// Then the reader's records are served, every search named at most two ids, three counted the
		// chunks, and one fetched the chunk that differed
		assert.deepEqual(narrowed, { ids: ['p1', 'p2', 'p7', 'gone'], size: 4 });
		assert.ok(
			termsSentOn(engine.searches, 'name').every((values) => values.length <= 2),
			JSON.stringify(engine.searches),
		);
		assert.deepEqual(
			engine.searches.map((search) => (search.body.aggs ? 'count' : 'fetch')),
			['count', 'count', 'count', 'fetch'],
		);
	});

	test('reads record ids from the engine itself for a set saved by _id', async () => {
		assert.deepEqual(await narrow({ ids: ['p6', 'p7'], path: '_id' }), { ids: ['p7'], size: 1 });
	});

	test('serves no ids and no size for a set whose path lies inside a nested field, asking the engine nothing', async () => {
		// Given a set saved at a path inside a nested field, whose values its nested objects hold
		const engine = createEngine();

		// When it is narrowed, Then it cannot be checked, so nothing of it is served
		assert.equal(
			await narrow({ engine, ids: ['bam'], nestedFieldNames: ['files'], path: 'files__file_type' }),
			null,
		);
		assert.deepEqual(engine.searches, []);
	});

	test('rejects when a shard fails, rather than serving a set it could not count', async () => {
		await assert.rejects(narrow({ engine: createEngine({ failedShards: 1 }), ids: ['p1', 'p3'] }));
	});
});
