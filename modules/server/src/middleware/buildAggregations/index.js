import { get, isEqual } from 'lodash';
import injectNestedFiltersToAggs from './injectNestedFiltersToAggs';
import getNestedSqonFilters from './getNestedSqonFilters';
import {
	AGGS_WRAPPER_FILTERED,
	AGGS_WRAPPER_GLOBAL,
	AGGS_WRAPPER_NESTED,
	ES_BOOL,
	ES_NESTED,
	ES_QUERY,
} from '../constants';
import createFieldAggregation from './createFieldAggregation';
import normalizeFilters from '../buildQuery/normalizeFilters';
import { opSwitch } from '../buildQuery';

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

	if (
		['terms', 'range'].some((k) => get(query, [k, fieldName])) ||
		get(query, ['exists', 'field']) === fieldName
	) {
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

function wrapWithFilters({ fieldName, query, aggregationsFilterThemselves, aggregation }) {
	if (!aggregationsFilterThemselves) {
		const cleanedQuery = removeFieldFromQuery({ fieldName, query });
		// TODO: better way to figure out that the field wasn't found
		if (!isEqual(cleanedQuery || {}, query || {})) {
			return createGlobalAggregation({
				fieldName,
				aggregation: createFilteredAggregation({
					fieldName,
					filter: cleanedQuery,
					aggregation,
				}),
			});
		}
	}
	return aggregation;
}

/**
 * graphqlFields: output from `graphql-fields` (https://github.com/robrichard/graphql-fields)
 */
export default function ({
	aggregationsFilterThemselves,
	graphqlFields,
	nestedFieldNames,
	query,
	sqon,
}) {
	const normalizedSqon = normalizeFilters(sqon);
	const aggs = Object.entries(graphqlFields).reduce((aggregations, [fieldKey, graphqlField]) => {
		const fieldName = fieldKey.replace(/__/g, '.');
		const nestedPaths = getNestedPathsInField({ fieldName, nestedFieldNames });
		const contentsFiltered = (normalizedSqon?.content || []).filter((c) =>
			aggregationsFilterThemselves
				? c.content?.fieldName?.startsWith(nestedPaths)
				: c.content?.fieldName?.startsWith(nestedPaths) && c.content?.fieldName !== fieldName,
		);
		const termFilters = contentsFiltered.map((filter) =>
			opSwitch({ nestedFieldNames: [], filter }),
		);

		const fieldAggregation = createFieldAggregation({
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
				fieldName,
				query,
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
	});

	return filteredAggregations;
}
