import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import buildAggregations from '#middleware/buildAggregations/index.js';
import buildQuery from '#middleware/buildQuery/index.js';

const DAY = '2024-03-15';
const WHOLE_DAY = { boost: 0, gte: '2024-03-15 00:00:00.000000', lte: '2024-03-15 23:59:59.999999' };

/** Every `range` or `terms` clause naming the field, anywhere in a compiled tree. */
const clausesOn = (fieldName, tree) =>
	tree !== null && typeof tree === 'object'
		? Object.entries(tree).flatMap(([key, value]) =>
				['range', 'terms'].includes(key) && value?.[fieldName] !== undefined
					? [{ [key]: value }]
					: clausesOn(fieldName, value),
			)
		: [];

const inClause = (fieldName, value) => ({ content: { fieldName, value }, op: 'in' });

suite('middleware/buildAggregations: a date alone means its whole day', () => {
	for (const nestingPrefix of [undefined, 'data']) {
		const esPath = (fieldName) => (nestingPrefix ? `${nestingPrefix}.${fieldName}` : fieldName);
		const where = nestingPrefix ? ' under a nesting prefix' : '';

		test(`a nested facet's filters cover the whole day of a date alone on a legacy-pattern field${where}`, () => {
			// Given a filter on a nested legacy-pattern date field, and a facet on another field of the same nested object
			const legacyDateFieldNames = ['visits.on'];
			const nestedFieldNames = ['visits'];
			const sqon = { content: [inClause('visits.on', [DAY])], op: 'and' };

			// When the facet's aggregation is built
			const aggregations = buildAggregations({
				aggregationsFilterThemselves: false,
				graphqlFields: { visits__kind: { buckets: { key: {} } } },
				legacyDateFieldNames,
				nestedFieldNames,
				nestingPrefix,
				query: buildQuery({ filters: sqon, legacyDateFieldNames, nestedFieldNames, nestingPrefix }),
				sqon,
			});

			// Then every clause it filters by on that field is the day's whole span
			const clauses = clausesOn(esPath('visits.on'), aggregations);
			assert.ok(clauses.length > 0, 'expected the facet to be filtered by the date');
			for (const clause of clauses) {
				assert.deepEqual(clause, { range: { [esPath('visits.on')]: WHOLE_DAY } });
			}
		});
	}

	test("a bucket's filter_by_term covers the whole day of a date alone on a legacy-pattern field", () => {
		// Given a facet whose buckets are filtered by a date alone on a legacy-pattern field
		const filterByTerm = { content: [inClause('diagnosed', [DAY])], op: 'and' };

		// When the facet's aggregation is built
		const aggregations = buildAggregations({
			aggregationsFilterThemselves: false,
			graphqlFields: {
				kind: { buckets: { filter_by_term: { __arguments: [{ filter: { value: filterByTerm } }] }, key: {} } },
			},
			legacyDateFieldNames: ['diagnosed'],
			nestedFieldNames: [],
			query: {},
			sqon: null,
		});

		// Then the term filter is the day's whole span
		assert.deepEqual(aggregations.kind.aggs.term_filters.filter, {
			bool: { must: [{ range: { diagnosed: WHOLE_DAY } }] },
		});
	});
});
