import { get, isEqual } from 'lodash';
import injectNestedFiltersToAggs from './injectNestedFiltersToAggs';
import getNestedSqonFilters from './getNestedSqonFilters';
import {
  AGGS_WRAPPER_GLOBAL,
  AGGS_WRAPPER_FILTERED,
  AGGS_WRAPPER_NESTED,
  ES_BOOL,
  ES_NESTED,
  ES_QUERY,
  STATS,
  HISTOGRAM,
  BUCKETS,
} from '../constants';

const MAX_AGGREGATION_SIZE = 300000;
const HISTOGRAM_INTERVAL_DEFAULT = 1000;

function createGlobalAggregation({ field, aggregation }) {
  return {
    [`${field}:${AGGS_WRAPPER_GLOBAL}`]: { global: {}, aggs: aggregation },
  };
}

function createFilteredAggregation({ field, filter, aggregation }) {
  return Object.keys(filter || {}).length
    ? { [`${field}:${AGGS_WRAPPER_FILTERED}`]: { filter, aggs: aggregation } }
    : aggregation;
}

function removeFieldFromQuery({ field, query }) {
  const nested = get(query, ES_NESTED);
  const nestedQuery = get(nested, ES_QUERY);
  const bool = get(query, ES_BOOL);

  if (
    ['terms', 'range'].some(k => get(query, [k, field])) ||
    get(query, ['exists', 'field']) === field
  ) {
    return null;
  } else if (nestedQuery) {
    const cleaned = removeFieldFromQuery({ field, query: nestedQuery });
    return (
      cleaned && { ...query, [ES_NESTED]: { ...nested, [ES_QUERY]: cleaned } }
    );
  } else if (bool) {
    const filtered = Object.entries(bool).reduce((acc, [type, values]) => {
      const filteredValues = values
        .map(value => removeFieldFromQuery({ field, query: value }))
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

function createNumericAggregation({ type, field, graphqlField }) {
  const args = get(graphqlField, [type, 'arguments', 0]) || {};

  return {
    [`${field}:${type}`]: {
      [type]: {
        field,
        ...(type === HISTOGRAM
          ? { interval: args.interval || HISTOGRAM_INTERVAL_DEFAULT }
          : {}),
      },
    },
  };
}

function createTermAggregation({ field, isNested }) {
  return {
    [field]: {
      ...(isNested ? { aggs: { rn: { reverse_nested: {} } } } : {}),
      terms: { field, size: MAX_AGGREGATION_SIZE },
    },
    [`${field}:missing`]: {
      ...(isNested ? { aggs: { rn: { reverse_nested: {} } } } : {}),
      missing: { field: field },
    },
  };
}

function createAggregation({ field, graphqlField = {}, isNested = false }) {
  const type = [BUCKETS, STATS, HISTOGRAM].find(t => graphqlField[t]);
  if (type === BUCKETS) {
    return createTermAggregation({ field, isNested });
  } else if ([STATS, HISTOGRAM].includes(type)) {
    return createNumericAggregation({ type, field, graphqlField });
  } else {
    return {};
  }
}

function getNestedPathsInField({ field, nestedFields }) {
  return field
    .split('.')
    .map((s, i, arr) => arr.slice(0, i + 1).join('.'))
    .filter(p => nestedFields.includes(p));
}

function wrapWithFilters({
  field,
  query,
  aggregationsFilterThemselves,
  aggregation,
}) {
  if (!aggregationsFilterThemselves) {
    const cleanedQuery = removeFieldFromQuery({ field, query });
    // TODO: better way to figure out that the field wasn't found
    if (!isEqual(cleanedQuery || {}, query || {})) {
      return createGlobalAggregation({
        field,
        aggregation: createFilteredAggregation({
          field,
          filter: cleanedQuery,
          aggregation,
        }),
      });
    }
  }
  return aggregation;
}

export default function({
  sqon,
  graphqlFields,
  nestedFields,
  aggregationsFilterThemselves,
  query,
}) {
  // TODO: support nested sqon operations
  const nestedSqonFilters = getNestedSqonFilters({ sqon, nestedFields });
  const aggs = Object.entries(graphqlFields).reduce(
    (aggregations, [fieldKey, graphqlField]) => {
      const field = fieldKey.replace(/__/g, '.');
      const nestedPaths = getNestedPathsInField({ field, nestedFields });
      const fieldAggregation = createAggregation({
        field,
        graphqlField,
        isNested: nestedPaths.length,
      });

      const aggregation = nestedPaths.reverse().reduce(
        (aggs, path) => ({
          [`${field}:${AGGS_WRAPPER_NESTED}`]: { nested: { path }, aggs },
        }),
        fieldAggregation,
      );

      return Object.assign(
        aggregations,
        wrapWithFilters({
          query,
          field,
          aggregation,
          aggregationsFilterThemselves,
        }),
      );
    },
    {},
  );

  const filteredAggregations = injectNestedFiltersToAggs({
    aggs,
    nestedSqonFilters,
    aggregationsFilterThemselves,
  });

  return filteredAggregations;
}
