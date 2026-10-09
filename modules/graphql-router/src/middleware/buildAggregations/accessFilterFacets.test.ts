import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import buildAggregations from '#middleware/buildAggregations/index.js';
import buildQuery from '#middleware/buildQuery/index.js';
import { AGGS_WRAPPER_FILTERED, AGGS_WRAPPER_GLOBAL } from '#middleware/constants.js';

type EsNode = Record<string, any>;

const clause = (op: string, fieldName: string, value: unknown[]) => ({ content: { fieldName, value }, op });
const group = (op: string, content: unknown[]) => ({ content, op });

/**
 * Every resource granted, resource A's categorized records through a second branch as well: the bare
 * resource test is the only alternative reaching a record with no category.
 */
const SERVER_SIDE_QUERY = buildQuery({
	filters: group('or', [
		group('and', [clause('in', 'resource', ['A']), clause('in', 'category', ['x', 'y', 'z'])]),
		clause('in', 'resource', ['A', 'B', 'C']),
	]),
});

const RESOURCE_FACET = { resource: { buckets: { doc_count: {}, key: {} } } };

const resourceFacetFor = (clientSideFilter: object | null): EsNode =>
	buildAggregations({
		aggregationsFilterThemselves: false,
		clientSideQuery: buildQuery({ filters: clientSideFilter ?? undefined }),
		graphqlFields: RESOURCE_FACET,
		nestedFieldNames: [],
		serverSideQuery: SERVER_SIDE_QUERY,
		sqon: clientSideFilter,
	});

/** The field names every terms or range query in `node` tests, wherever it sits. */
const fieldNamesIn = (node: unknown): string[] => {
	if (Array.isArray(node)) {
		return node.flatMap(fieldNamesIn);
	}
	if (typeof node !== 'object' || node === null) {
		return [];
	}
	const own = ['range', 'terms'].flatMap((kind) =>
		kind in node ? Object.keys((node as EsNode)[kind]).filter((key) => key !== 'boost') : [],
	);
	return [...own, ...Object.values(node).flatMap(fieldNamesIn)];
};

suite('a facet that does not filter itself, under an access filter naming its field', () => {
	test('counts within the search query when only the access filter names the field, so the access filter applies whole', () => {
		// Given no client filter, and an access filter whose bare resource test is one alternative of an `or`
		// When the resource facet is built
		const aggregations = resourceFacetFor(null);

		// Then it is not rebuilt apart from the search query, where the access filter applies as written
		assert.equal(
			Object.hasOwn(aggregations, `resource:${AGGS_WRAPPER_GLOBAL}`),
			false,
			JSON.stringify(aggregations),
		);
	});

	test("restates the access filter whole beside the client's filter less the facet's field", () => {
		// Given a client filter on the facet's field and another, and the same access filter
		// When the resource facet is built
		const aggregations = resourceFacetFor(
			group('and', [clause('in', 'resource', ['A']), clause('in', 'category', ['y'])]),
		);

		// Then its rebuilt filter is the client's category clause beside the access filter, unchanged
		const filter =
			aggregations[`resource:${AGGS_WRAPPER_GLOBAL}`]?.aggs?.[`resource:${AGGS_WRAPPER_FILTERED}`]?.filter;
		const [clientPart, serverPart] = filter?.bool?.must ?? [];
		assert.deepEqual(serverPart, SERVER_SIDE_QUERY);
		assert.deepEqual(fieldNamesIn(clientPart), ['category']);
	});
});
