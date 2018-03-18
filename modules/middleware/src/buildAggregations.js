import { get, isEqual } from 'lodash';

import {
  AGGS_WRAPPER_GLOBAL,
  AGGS_WRAPPER_FILTERED,
  AGGS_WRAPPER_NESTED,
  ES_BOOL,
  ES_MUST,
  ES_NESTED,
  ES_QUERY,
  STATS,
  HISTOGRAM,
  BUCKETS,
} from './constants';

const MAX_AGGREGATION_SIZE = 300000;
const HISTOGRAM_INTERVAL_DEFAULT = 1000;

function createGlobalAggregation({ field, aggs }) {
  return {
    [`${field}:${AGGS_WRAPPER_GLOBAL}`]: {
      global: {},
      aggs,
    },
  };
}

function createFilteredAggregation(field, filters, aggs) {
  return {
    [`${field}:${AGGS_WRAPPER_FILTERED}`]: {
      filter: filters,
      aggs,
    },
  };
}

function removeFieldFromQuery({ field, query }) {
  // TODO: must_not? should?
  const musts = get(query, [ES_BOOL, ES_MUST]) || [];
  const filteredMusts = musts
    .map(must => {
      if (['terms', 'range'].some(key => get(must, [key, field]))) return null;
      const nested = get(must, ES_NESTED);
      const nestedQuery = get(nested, ES_QUERY);
      if (nestedQuery) {
        const cleaned = removeFieldFromQuery({ field, query: nestedQuery });
        return (
          cleaned && {
            [ES_NESTED]: { ...nested, [ES_QUERY]: cleaned },
          }
        );
      } else {
        return must;
      }
    })
    .filter(Boolean);

  return filteredMusts.length === 0
    ? null
    : { [ES_BOOL]: { [ES_MUST]: filteredMusts } };
}

function createNumericAggregation({ field, graphqlField }) {
  const type = [STATS, HISTOGRAM].find(t => graphqlField[t]);
  if (!type) {
    return {};
  } else {
    const args = get(graphqlField, [type, 'arguments', 0]) || {};

    return {
      [`${field}:${type}`]: {
        [type]: {
          field,
          ...(type === HISTOGRAM
            ? {
                interval: args.interval || HISTOGRAM_INTERVAL_DEFAULT,
              }
            : {}),
        },
      },
    };
  }
}

function createTermAggregation({ field, isNested }) {
  return {
    [field]: {
      ...(isNested ? { aggs: { rn: { reverse_nested: {} } } } : {}),
      terms: { field, size: MAX_AGGREGATION_SIZE },
    },
  };
}

function createAggregation({ field, graphqlField, isNested = false }) {
  if (!graphqlField) {
    return {};
  } else if (graphqlField[BUCKETS]) {
    return createTermAggregation({ field, isNested });
  } else {
    return createNumericAggregation({ field, graphqlField });
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
        aggs: cleanedQuery
          ? createFilteredAggregation(field, cleanedQuery, aggregation)
          : aggregation,
      });
    }
  }
  return aggregation;
}

function buildAggregations({
  graphqlFields,
  nestedFields,
  query,
  aggregationsFilterThemselves,
}) {
  return Object.keys(graphqlFields).reduce((aggregations, rawField) => {
    const field = rawField.split('__').join('.');
    const nestedPaths = getNestedPathsInField({ field, nestedFields });
    const isNested = nestedPaths.length;
    const fieldAgg = createAggregation({
      field,
      graphqlField: graphqlFields[rawField],
      isNested,
    });

    const aggregation = nestedPaths.reverse().reduce(
      (aggs, path) => ({
        [`${field}:${AGGS_WRAPPER_NESTED}`]: {
          nested: { path },
          aggs,
        },
      }),
      fieldAgg,
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
  }, {});
}

export default buildAggregations;
