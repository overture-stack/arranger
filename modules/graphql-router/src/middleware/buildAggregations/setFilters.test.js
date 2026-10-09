import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import buildAggregations from '#middleware/buildAggregations/index.js';
import buildQuery from '#middleware/buildQuery/index.js';

const SETS_INDEX = 'catalogue-sets';
const NESTED_FIELD_NAMES = ['donors'];

/** A saved-set clause on a field at the facet's own nested level, so every facet-level mechanism compiles it. */
const SET_FILTER = {
	content: [{ content: { fieldName: 'donors.donor_id', value: ['set_id:abc'] }, op: 'in' }],
	op: 'and',
};

/** Every terms lookup in a compiled aggregation: the objects naming a set by `id` and `path`. */
const lookupsIn = (node) =>
	node === null || typeof node !== 'object'
		? []
		: [...(node.path === 'ids' && 'id' in node ? [node] : []), ...Object.values(node).flatMap(lookupsIn)];

const aggregationsFor = (aggregationsFilterThemselves) =>
	buildAggregations({
		aggregationsFilterThemselves,
		clientSideQuery: buildQuery({
			filters: SET_FILTER,
			nestedFieldNames: NESTED_FIELD_NAMES,
			setsIndex: SETS_INDEX,
		}),
		graphqlFields: {
			donors__gender: {
				buckets: {
					filter_by_term: { __arguments: [{ filter: { kind: 'Variable', value: SET_FILTER } }] },
					key: {},
				},
			},
		},
		nestedFieldNames: NESTED_FIELD_NAMES,
		setsIndex: SETS_INDEX,
		sqon: SET_FILTER,
	});

suite("a nested facet looks a saved set up in the catalogue's own sets index", () => {
	for (const aggregationsFilterThemselves of [true, false]) {
		test(`through its term filters, its nested filter and its bucket filter, filtering themselves ${aggregationsFilterThemselves}`, () => {
			// Given a facet on a nested field, and a saved-set clause on another field at that level
			// When its aggregation compiles
			const lookups = lookupsIn(aggregationsFor(aggregationsFilterThemselves));

			// Then each of the three facet-level filters looks the set up, and every lookup names the catalogue's index
			assert.equal(lookups.length, 3, JSON.stringify(lookups));
			assert.ok(
				lookups.every((lookup) => lookup.index === SETS_INDEX),
				JSON.stringify(lookups),
			);
		});
	}
});
