import { get, isEqual } from 'lodash-es';

import { opSwitch } from '#middleware/buildQuery/index.js';
import normalizeFilters from '#middleware/buildQuery/normalizeFilters.js';
import {
	AGGS_WRAPPER_FILTERED,
	AGGS_WRAPPER_GLOBAL,
	AGGS_WRAPPER_NESTED,
	ES_BOOL,
	ES_NESTED,
	ES_QUERY,
} from '#middleware/constants.js';
import {
	applyNestingPrefix,
	applyNestingPrefixToFieldNames,
	applyNestingPrefixToSqon,
} from '#middleware/utils/nestingPrefix.js';

import createFieldAggregation from './createFieldAggregation.js';
import getNestedSqonFilters from './getNestedSqonFilters.js';
import injectNestedFiltersToAggs from './injectNestedFiltersToAggs.js';

function createGlobalAggregation({ fieldName, aggregation }) {
	return {
		[`${fieldName}:${AGGS_WRAPPER_GLOBAL}`]: { global: {}, aggs: aggregation },
	};
}

function createFilteredAggregation({ fieldName, filter, aggregation }) {
	return Object.keys(filter || {}).length
		? { [`${fieldName}:${AGGS_WRAPPER_FILTERED}`]: { filter, aggs: aggregation } }
		: aggregation;
}

function removeFieldFromQuery({ fieldName, query }) {
	const nested = get(query, ES_NESTED);
	const nestedQuery = get(nested, ES_QUERY);
	const bool = get(query, ES_BOOL);

	if (['terms', 'range'].some((k) => get(query, [k, fieldName])) || get(query, ['exists', 'field']) === fieldName) {
		return null;
	} else if (nestedQuery) {
		const cleaned = removeFieldFromQuery({ fieldName, query: nestedQuery });
		return cleaned && { ...query, [ES_NESTED]: { ...nested, [ES_QUERY]: cleaned } };
	} else if (bool) {
		const filtered = Object.entries(bool).reduce((acc, [type, values]) => {
			const filteredValues = values
				.map((value) => removeFieldFromQuery({ fieldName, query: value }))
				.filter(Boolean);
			if (filteredValues.length > 0) {
				acc[type] = filteredValues;
			}
			return acc;
		}, {});

		// `null` means "nothing left", whether every clause named this field or there were none.
		return Object.keys(filtered).length > 0 ? { [ES_BOOL]: filtered } : null;
	} else {
		return query;
	}
}

function getNestedPathsInField({ fieldName = '', nestedFieldNames = [] }) {
	return fieldName
		.split('.')
		.map((s, i, arr) => arr.slice(0, i + 1).join('.'))
		.filter((p) => nestedFieldNames.includes(p));
}

/**
 * Re-applies the access-control filter after field-removal strips it along with the caller's own
 * filter on the aggregated field, the two being indistinguishable once `compileFilter` merges them.
 * Duplicate clauses on other fields are harmless: same result, and `boost: 0` leaves scoring alone.
 */
function reapplyServerFilter({ cleanedQuery, serverSideQuery }) {
	if (!serverSideQuery || !Object.keys(serverSideQuery).length) {
		return cleanedQuery;
	}

	return cleanedQuery && Object.keys(cleanedQuery).length
		? { [ES_BOOL]: { must: [cleanedQuery, serverSideQuery] } }
		: serverSideQuery;
}

function wrapWithFilters({
	esFieldName,
	fieldName,
	query,
	serverSideQuery,
	aggregationsFilterThemselves,
	aggregation,
}) {
	if (!aggregationsFilterThemselves) {
		const cleanedQuery = removeFieldFromQuery({ fieldName: esFieldName, query });
		// TODO: better way to figure out that the field wasn't found
		// Relies on `query` never being empty, which `compileFilter` guarantees by rejecting a
		// clause-less server-side filter. An empty one would compare unequal to `null` and wrap
		// every field.
		if (!isEqual(cleanedQuery || {}, query || {})) {
			return createGlobalAggregation({
				fieldName,
				// A `global` aggregation ignores the search query, so anything that must still
				// constrain this one has to be restated here, access control included.
				aggregation: createFilteredAggregation({
					fieldName,
					filter: reapplyServerFilter({ cleanedQuery, serverSideQuery }),
					aggregation,
				}),
			});
		}
	}
	return aggregation;
}

/**
 * graphqlFields: output from `graphql-fields` (https://github.com/robrichard/graphql-fields)
 *
 * `nestingPrefix` (see `middleware/utils/nestingPrefix.ts`) only ever affects the real ES field
 * path (`esFieldName`) and `nestedFieldNames`/`sqon` used to build the query DSL; every response
 * key (bucket names, `:missing`/`:nested_filtered` suffixes) stays built from the clean `fieldName`
 * so `flattenAggregations` and the GraphQL layer above it need no awareness of the prefix at all.
 */
const buildAggregations = ({
	aggregationsFilterThemselves,
	graphqlFields,
	nestedFieldNames: rawNestedFieldNames,
	nestingPrefix,
	query,
	rawPathsByGraphqlFlatName = {},
	serverSideQuery,
	sqon,
}) => {
	const nestedFieldNames =
		applyNestingPrefixToFieldNames(rawNestedFieldNames, nestingPrefix) ?? rawNestedFieldNames ?? [];
	const normalizedSqon = normalizeFilters(applyNestingPrefixToSqon(sqon, nestingPrefix));
	const aggs = Object.entries(graphqlFields).reduce((aggregations, [fieldKey, graphqlField]) => {
		const fieldName = fieldKey.replace(/__/g, '.');
		// `fieldName` stays the response key; only the ES path is translated back. Undoing `__`
		// recovers nesting but not sanitized characters, so `qc_metrics__batch_id` would reach
		// Elasticsearch as `qc_metrics.batch_id` and match nothing. Also feeds the raw-name
		// comparisons below.
		const rawFieldPath = rawPathsByGraphqlFlatName[fieldKey] ?? fieldName;
		const esFieldName = applyNestingPrefix(rawFieldPath, nestingPrefix);
		const nestedPaths = getNestedPathsInField({ fieldName: esFieldName, nestedFieldNames });
		const contentsFiltered = (normalizedSqon?.content || []).filter((c) =>
			aggregationsFilterThemselves
				? c.content?.fieldName?.startsWith(nestedPaths)
				: c.content?.fieldName?.startsWith(nestedPaths) && c.content?.fieldName !== esFieldName,
		);
		const termFilters = contentsFiltered.map((filter) => opSwitch({ nestedFieldNames: [], filter }));

		const fieldAggregation = createFieldAggregation({
			esFieldName,
			fieldName,
			graphqlField,
			isNested: nestedPaths.length,
			termFilters,
		});

		const aggregation = nestedPaths.reverse().reduce(
			(aggs, path) => ({
				[`${fieldName}:${AGGS_WRAPPER_NESTED}`]: { nested: { path }, aggs },
			}),
			fieldAggregation,
		);

		return Object.assign(
			aggregations,
			wrapWithFilters({
				aggregation,
				aggregationsFilterThemselves,
				esFieldName,
				fieldName,
				query,
				serverSideQuery,
			}),
		);
	}, {});

	const nestedSqonFilters = getNestedSqonFilters({
		nestedFieldNames,
		sqon: normalizedSqon,
	});

	const filteredAggregations = injectNestedFiltersToAggs({
		aggregationsFilterThemselves,
		aggs,
		nestedSqonFilters,
		nestingPrefix,
	});

	return filteredAggregations;
};

export default buildAggregations;
