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
		// A bool that arrived with no clauses is an empty combination, which means every document; it is
		// kept, so a facet reads it as hits do. Only a bool this removal empties is dropped.
		if (!Object.values(bool).some((values) => values.length > 0)) {
			return query;
		}

		const filtered = Object.entries(bool).reduce((acc, [type, values]) => {
			const filteredValues = values
				.map((value) => removeFieldFromQuery({ fieldName, query: value }))
				.filter(Boolean);
			if (filteredValues.length > 0) {
				acc[type] = filteredValues;
			}
			return acc;
		}, {});

		// `null` means every clause named this field, so nothing of this part of the filter is left.
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
 * The access-control filter, whole, beside the caller's filter less the aggregated field. Only the
 * caller's filter loses that field's clauses: removing one from the access filter could drop an
 * alternative of an `or`, and count fewer documents than the principal may see.
 */
function composeWithServerFilter({ cleanedQuery, serverSideQuery }) {
	if (!serverSideQuery || !Object.keys(serverSideQuery).length) {
		return cleanedQuery;
	}

	return cleanedQuery && Object.keys(cleanedQuery).length
		? { [ES_BOOL]: { must: [cleanedQuery, serverSideQuery] } }
		: serverSideQuery;
}

function wrapWithFilters({
	aggregation,
	aggregationsFilterThemselves,
	clientSideQuery,
	esFieldName,
	fieldName,
	serverSideQuery,
}) {
	if (!aggregationsFilterThemselves) {
		const cleanedQuery = removeFieldFromQuery({ fieldName: esFieldName, query: clientSideQuery });
		// TODO: better way to figure out that the field wasn't found
		// `removeFieldFromQuery` returns a bool that arrived empty unchanged, so only a clause on the
		// aggregated field makes the cleaned query differ and calls for the global wrapper. Otherwise
		// the facet counts within the search query, the access-control filter included.
		if (!isEqual(cleanedQuery || {}, clientSideQuery || {})) {
			return createGlobalAggregation({
				fieldName,
				// A `global` aggregation ignores the search query, so anything that must still
				// constrain this one has to be restated here, access control included.
				aggregation: createFilteredAggregation({
					fieldName,
					filter: composeWithServerFilter({ cleanedQuery, serverSideQuery }),
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
 *
 * `clientSideQuery` is the caller's filter compiled alone, from which a facet not filtering itself
 * removes its own field; `serverSideQuery` is the access-control filter compiled alone, which such a
 * facet restates whole.
 *
 * @param {object} args
 * @param {boolean} args.aggregationsFilterThemselves Whether a facet's own field filters it.
 * @param {object} [args.clientSideQuery] The caller's filter, compiled alone.
 * @param {boolean} [args.disableClientFilters] Whether the deployment ignores callers' filters.
 * @param {object} args.graphqlFields The requested aggregations, as `graphql-fields` reads them.
 * @param {string[]} [args.nestedFieldNames] Paths mapped as `nested`.
 * @param {string} [args.nestingPrefix] Prefix applied to field names before compilation.
 * @param {Record<string, string>} [args.rawPathsByGraphqlFlatName] Each flattened GraphQL name's ES path.
 * @param {object} [args.serverSideQuery] The access-control filter, compiled alone.
 * @param {string} [args.setsIndex] The catalogue's own sets index.
 * @param {object | null} [args.sqon] The caller's filter, as a SQON.
 * @returns {object} The aggregations, keyed by name.
 */
const buildAggregations = ({
	aggregationsFilterThemselves,
	clientSideQuery,
	disableClientFilters = false,
	graphqlFields,
	nestedFieldNames: rawNestedFieldNames,
	nestingPrefix,
	rawPathsByGraphqlFlatName = {},
	serverSideQuery,
	setsIndex,
	sqon,
}) => {
	const nestedFieldNames =
		applyNestingPrefixToFieldNames(rawNestedFieldNames, nestingPrefix) ?? rawNestedFieldNames ?? [];
	// Where client filters are disabled, no facet reads the client's filter, as the query does not.
	const normalizedSqon = disableClientFilters
		? undefined
		: normalizeFilters(applyNestingPrefixToSqon(sqon, nestingPrefix));
	const aggs = Object.entries(graphqlFields).reduce((aggregations, [fieldKey, graphqlField]) => {
		const fieldName = fieldKey.replace(/__/g, '.');
		// `fieldName` stays the response key; only the ES path is translated back. Undoing `__`
		// recovers nesting but not sanitized characters, so `qc_metrics__batch_id` would reach
		// Elasticsearch as `qc_metrics.batch_id` and match nothing. Also feeds the raw-name
		// comparisons below.
		const rawFieldPath = rawPathsByGraphqlFlatName[fieldKey] ?? fieldName;
		const esFieldName = applyNestingPrefix(rawFieldPath, nestingPrefix);
		const nestedPaths = getNestedPathsInField({ fieldName: esFieldName, nestedFieldNames });
		const innermostPath = nestedPaths.at(-1);
		const contentsFiltered = (normalizedSqon?.content || []).filter((c) =>
			aggregationsFilterThemselves
				? c.content?.fieldName?.startsWith(nestedPaths)
				: c.content?.fieldName?.startsWith(nestedPaths) && c.content?.fieldName !== esFieldName,
		);
		// Term filters apply inside the facet's innermost nested scope, so only a level below it still
		// needs its own nested query.
		const pathsBelowFacet = innermostPath
			? nestedFieldNames.filter((path) => path.startsWith(`${innermostPath}.`))
			: [];
		const termFilters = contentsFiltered.map((filter) =>
			opSwitch({ nestedFieldNames: pathsBelowFacet, filter, setsIndex }),
		);

		const fieldAggregation = createFieldAggregation({
			disableClientFilters,
			esFieldName,
			fieldName,
			graphqlField,
			isNested: nestedPaths.length,
			setsIndex,
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
				clientSideQuery,
				esFieldName,
				fieldName,
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
		setsIndex,
	});

	return filteredAggregations;
};

export default buildAggregations;
