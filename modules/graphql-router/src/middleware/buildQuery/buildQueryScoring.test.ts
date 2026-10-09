import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import compileFilter from '#mapping/utils/compileFilter.js';
import buildQuery from '#middleware/buildQuery/index.js';

type EsNode = Record<string, unknown>;

const clause = (op: string, fieldName: string, value: unknown) => ({ content: { fieldName, value }, op });
const group = (op: string, content: unknown[]) => ({ content, op });

/**
 * An access filter shaped as a narrowing granting categories is: each branch tests a resource and a
 * category, an unmarked branch excludes every mapped category, a bare resource test stands beside them,
 * and a range and a missing value cover the remaining operators an access filter may use.
 */
const ACCESS_FILTER = group('or', [
	group('and', [clause('in', 'study', ['HEART']), clause('in', 'category', ['controlled'])]),
	group('and', [clause('in', 'study', ['HEART', 'REEF']), group('not', [clause('in', 'category', ['controlled'])])]),
	clause('in', 'study', ['LUNG']),
	group('and', [clause('gte', 'age', 18), clause('not-in', 'category', ['__missing__'])]),
]);

/** Every query that matches documents on its own in `node`, descending through `bool` and `nested`. */
const leafQueriesOf = (node: unknown): EsNode[] => {
	if (Array.isArray(node)) {
		return node.flatMap(leafQueriesOf);
	}
	if (typeof node !== 'object' || node === null) {
		return [];
	}
	const query = node as EsNode;
	if ('bool' in query) {
		const bool = query.bool as EsNode;
		return ['filter', 'must', 'must_not', 'should'].flatMap((occurrence) => leafQueriesOf(bool[occurrence] ?? []));
	}
	if ('nested' in query) {
		return leafQueriesOf((query.nested as EsNode).query);
	}
	return [query];
};

/** The boost a leaf query carries, wherever its kind keeps it. */
const boostOf = (leaf: EsNode): unknown => {
	const [[kind, body]] = Object.entries(leaf) as [[string, EsNode]];
	return kind === 'range' ? (Object.values(body)[0] as EsNode).boost : body.boost;
};

suite('an access filter compiled into a query', () => {
	test('scores no document, every clause it compiles carrying boost 0, so it never changes the order of results', () => {
		// Given an access filter composed beside an empty client filter, as every read path composes one
		const query = buildQuery({
			filters: compileFilter({ clientSideFilter: { content: [], op: 'and' }, serverSideFilter: ACCESS_FILTER }),
		});

		// When its clauses are collected
		const leaves = leafQueriesOf(query);

		// Then there are some, each a terms, exists or range query, and each carries boost 0
		assert.ok(leaves.length >= 7, JSON.stringify(query));
		assert.deepEqual(
			leaves.filter(
				(leaf) => !['exists', 'range', 'terms'].includes(Object.keys(leaf)[0] ?? '') || boostOf(leaf) !== 0,
			),
			[],
		);
	});
});
