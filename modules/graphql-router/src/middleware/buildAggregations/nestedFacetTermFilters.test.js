import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import buildAggregations from './index.js';

const NESTED_FIELD_NAMES = ['donors', 'donors.specimens'];

/** One catalogue stores its documents at the top level, the other under a prefix the router strips. */
const LAYOUTS = [
	{ description: 'with no nesting prefix', nestingPrefix: undefined, prefix: '' },
	{ description: 'under a nesting prefix', nestingPrefix: 'data', prefix: 'data.' },
];

const clause = (op, fieldName, value) => ({ content: { fieldName, value }, op });

const terms = (fieldName, value) => ({ terms: { boost: 0, [fieldName]: value } });

/** The aggregation stored under `key` at any depth, wherever other filters wrap it. */
const findAggregation = (aggregations, key) =>
	Object.entries(aggregations ?? {}).reduce(
		(found, [name, aggregation]) => found ?? (name === key ? aggregation : findAggregation(aggregation.aggs, key)),
		undefined,
	);

/** The filters the donor facet applies inside its own nested scope, before it counts donor ids. */
const donorFacetTermFilters = ({ aggregationsFilterThemselves, nestingPrefix, sqon }) =>
	findAggregation(
		buildAggregations({
			aggregationsFilterThemselves,
			graphqlFields: { donors__donor_id: { buckets: { key: {} } } },
			nestedFieldNames: NESTED_FIELD_NAMES,
			nestingPrefix,
			query: {},
			serverSideQuery: {},
			sqon: { content: [sqon], op: 'and' },
		}),
		'donors.donor_id:nested_filtered',
	)?.filter?.bool?.must;

suite('a facet on a nested field applies each clause at the level its field is on', () => {
	for (const { description, nestingPrefix, prefix } of LAYOUTS) {
		for (const aggregationsFilterThemselves of [false, true]) {
			const label = `${description}, filtering themselves ${aggregationsFilterThemselves}`;

			test(`an in on a level below the facet's keeps that level's nested query, ${label}`, () => {
				// Given a facet on donors, and a clause on their specimens, one nested level down
				const sqon = clause('in', 'donors.specimens.tissue', ['Solid']);

				// When the facet's aggregation is built
				const termFilters = donorFacetTermFilters({ aggregationsFilterThemselves, nestingPrefix, sqon });

				// Then the clause reaches the specimens through their own nested query
				assert.deepEqual(termFilters, [
					{
						nested: {
							path: `${prefix}donors.specimens`,
							query: { bool: { must: [terms(`${prefix}donors.specimens.tissue`, ['Solid'])] } },
						},
					},
				]);
			});

			test(`a not-in on a level below the facet's negates inside that level's nested query, ${label}`, () => {
				// Given a facet on donors, and an exclusion on their specimens
				const sqon = clause('not-in', 'donors.specimens.tissue', ['Solid']);

				// When the facet's aggregation is built
				const termFilters = donorFacetTermFilters({ aggregationsFilterThemselves, nestingPrefix, sqon });

				// Then a donor qualifies through a specimen outside the list, as it does for hits
				assert.deepEqual(termFilters, [
					{
						nested: {
							path: `${prefix}donors.specimens`,
							query: { bool: { must_not: [terms(`${prefix}donors.specimens.tissue`, ['Solid'])] } },
						},
					},
				]);
			});

			test(`a clause on the facet's own level applies as written, ${label}`, () => {
				// Given a facet on donors, and a clause on another field of the donor itself
				const sqon = clause('in', 'donors.sex', ['female']);

				// When the facet's aggregation is built
				const termFilters = donorFacetTermFilters({ aggregationsFilterThemselves, nestingPrefix, sqon });

				// Then the clause needs no nested query, since the facet already counts within each donor
				assert.deepEqual(termFilters, [terms(`${prefix}donors.sex`, ['female'])]);
			});
		}
	}
});
