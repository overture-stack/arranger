import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { includeEverything } from '#index.js';
import compileFilter from '#mapping/utils/compileFilter.js';
import buildQuery from '#middleware/buildQuery/index.js';

import { denyAllFilter, restrictingFilter } from './serverSideFilters.fixture.js';

type StoredDocument = { _id: string; _source: Record<string, string | string[]> };
type SearchQuery = Record<string, any>;

// The documents a filter that tests field values could trip on: a field missing entirely, and a
// field holding several values.
const DOCUMENTS: StoredDocument[] = [
	{ _id: 'DO_01', _source: { donor_id: 'DO_01', study: 'A' } },
	{ _id: 'DO_02', _source: { donor_id: 'DO_02', study: 'B' } },
	{ _id: 'DO_03', _source: { donor_id: 'DO_03' } },
	{ _id: 'DO_04', _source: { donor_id: 'DO_04', study: ['A', 'B'] } },
	{ _id: 'DO_05', _source: {} },
];
const ALL_IDS = DOCUMENTS.map(({ _id }) => _id);

const valuesOf = (document: StoredDocument, fieldName: string): unknown[] =>
	fieldName === '_id' ? [document._id] : [document._source[fieldName]].flat().filter((value) => value !== undefined);

const asList = (clauses: unknown): SearchQuery[] => (clauses === undefined ? [] : ([clauses].flat() as SearchQuery[]));

/**
 * Evaluates the part of the query DSL a compiled SQON uses, so a test can assert which documents a
 * filter keeps rather than what its query looks like. Anything else throws, so an unfamiliar clause
 * fails the test instead of matching silently.
 */
const matchesQuery = (document: StoredDocument, query: SearchQuery | undefined): boolean => {
	if (query === undefined || Object.keys(query).length === 0 || 'match_all' in query) {
		return true;
	}

	if ('terms' in query) {
		const termsEntry = Object.entries(query.terms as Record<string, unknown[]>).find(([key]) => key !== 'boost');
		assert.ok(termsEntry, `The test evaluator found no field in ${JSON.stringify(query)}`);
		const [fieldName, values] = termsEntry;
		return valuesOf(document, fieldName).some((value) => values.includes(value));
	}

	if ('bool' in query) {
		const { filter, minimum_should_match: minimumShouldMatch, must, must_not: mustNot, should } = query.bool;
		const required = [...asList(must), ...asList(filter)];
		const optional = asList(should);
		const optionalNeeded = minimumShouldMatch ?? (required.length === 0 && optional.length > 0 ? 1 : 0);

		return (
			required.every((clause) => matchesQuery(document, clause)) &&
			!asList(mustNot).some((clause) => matchesQuery(document, clause)) &&
			optional.filter((clause) => matchesQuery(document, clause)).length >= optionalNeeded
		);
	}

	throw new Error(`The test evaluator cannot evaluate ${JSON.stringify(query)}`);
};

/** The ids of the documents a server-side filter, composed with an optional client filter, keeps. */
const keptIds = ({ clientSideFilter, serverSideFilter }: { clientSideFilter?: unknown; serverSideFilter: unknown }) => {
	const query = buildQuery({
		filters: compileFilter({ clientSideFilter, serverSideFilter }),
		nestedFieldNames: [],
		nestingPrefix: undefined,
	});

	return DOCUMENTS.filter((document) => matchesQuery(document, query)).map(({ _id }) => _id);
};

/** Every leaf clause in a SQON node, whatever combination shape wraps it. */
const leavesOf = (node: any): any[] =>
	Array.isArray(node?.content) ? node.content.flatMap(leavesOf) : node?.content?.fieldName ? [node] : [];

suite('accessControl/includeEverything', () => {
	test('is exported from the package root as a synchronous filter callback', () => {
		// Given the callback the package root exports
		// When it is called with a context
		const filter = includeEverything({});

		// Then it is an ordinary function returning a SQON node, never a promise of one
		assert.equal(typeof includeEverything, 'function');
		assert.notEqual(includeEverything.constructor.name, 'AsyncFunction');
		assert.equal(typeof filter, 'object');
		assert.equal(typeof (filter as { then?: unknown }).then, 'undefined');
	});

	test('keeps every document, including ones missing the field or holding several values', () => {
		// Given documents a value-testing filter could exclude, and two filters that do exclude some
		const restricting = restrictingFilter({ fieldName: 'study', values: ['A'] })({});
		const denying = denyAllFilter('study')({});

		// When each is compiled and evaluated against the documents
		const keptByIncludeEverything = keptIds({ serverSideFilter: includeEverything({}) });

		// Then includeEverything keeps all of them, where the others demonstrably do not
		assert.deepEqual(keptByIncludeEverything, ALL_IDS);
		assert.deepEqual(keptIds({ serverSideFilter: restricting }), ['DO_01', 'DO_04']);
		assert.deepEqual(keptIds({ serverSideFilter: denying }), []);
	});

	test("leaves a caller's own filter to narrow the result on its own", () => {
		// Given a client filter selecting study B
		const clientSideFilter = { content: { fieldName: 'study', value: ['B'] }, op: 'in' };

		// When it is composed with includeEverything
		const kept = keptIds({ clientSideFilter, serverSideFilter: includeEverything({}) });

		// Then exactly the client's selection remains
		assert.deepEqual(kept, ['DO_02', 'DO_04']);
	});

	test("ignores the context it is given, so neither a request's identity nor a router's record changes it", () => {
		// Given contexts ranging from none at all to one carrying an identity and a restricting record
		const contexts = [
			undefined,
			{},
			{ request: { headers: new Headers({ authorization: 'Bearer someone' }) } },
			{
				[Symbol.for('@overture-stack/arranger-graphql-router/accessControl')]: {
					getServerSideFilter: restrictingFilter({ fieldName: 'study', values: ['A'] }),
					source: 'configured',
				},
			},
		];

		// When includeEverything is called with each
		const filters = contexts.map((context) => includeEverything(context));

		// Then every result is the same filter, and keeps every document
		filters.forEach((filter) => {
			assert.deepEqual(filter, includeEverything({}));
			assert.deepEqual(keptIds({ serverSideFilter: filter }), ALL_IDS);
		});
	});

	test('carries a leaf clause, so compileFilter accepts it while refusing an empty combination', () => {
		// Given includeEverything's filter and an empty combination, both of which match everything
		const filter = includeEverything({});

		// When compileFilter is given each
		// Then only the empty combination is refused, because only it is reachable by pruning
		assert.ok(leavesOf(filter).length >= 1);
		assert.doesNotThrow(() => compileFilter({ clientSideFilter: undefined, serverSideFilter: filter }));
		assert.throws(() =>
			compileFilter({ clientSideFilter: undefined, serverSideFilter: { content: [], op: 'and' } }),
		);
	});

	test('carries the negation of an _id leaf with no values, until the sqon package provides matchEverything', () => {
		// Given the shape agreed for rc.7
		// When includeEverything is called
		const filter = includeEverything({});

		// Then it is exactly that shape
		assert.deepEqual(filter, {
			content: [{ content: { fieldName: '_id', value: [] }, op: 'in' }],
			op: 'not',
		});
	});
});
