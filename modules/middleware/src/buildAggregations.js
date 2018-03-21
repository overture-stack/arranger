import { get, isEqual } from 'lodash';

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
} from './constants';

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
  const filtered = Object.entries(get(query, ES_BOOL, {})).reduce(
    (bool, [type, values]) => {
      const filteredValues = values
        .map(value => {
          if (['terms', 'range'].some(k => get(value, [k, field]))) return null;
          const nested = get(value, ES_NESTED);
          const nestedQuery = get(nested, ES_QUERY);
          if (nestedQuery) {
            const cleaned = removeFieldFromQuery({ field, query: nestedQuery });
            return (
              cleaned && { [ES_NESTED]: { ...nested, [ES_QUERY]: cleaned } }
            );
          } else {
            return value;
          }
        })
        .filter(Boolean);

      return filteredValues.length > 0
        ? { ...bool, [type]: filteredValues }
        : bool;
    },
    {},
  );

  return Object.keys(filtered).length > 0 ? { [ES_BOOL]: filtered } : null;
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
  graphqlFields,
  nestedFields,
  query,
  aggregationsFilterThemselves,
}) {
  return Object.entries(graphqlFields).reduce(
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

      return {
        ...aggregations,
        ...wrapWithFilters({
          query,
          field,
          aggregation,
          aggregationsFilterThemselves,
        }),
      };
    },
    {},
  );
}
