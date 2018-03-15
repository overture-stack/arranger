import { get, isEqual } from 'lodash';

import * as CONSTANTS from './constants';
import { AGGS_WRAPPER_TYPES } from './constants';

const MAX_AGGREGATION_SIZE = 300000;
const HISTOGRAM_INTERVAL_DEFAULT = 1000;

function createGlobalAggregation({ field, aggs }) {
  return {
    [`${field}:${AGGS_WRAPPER_TYPES.GLOBAL}`]: {
      global: {},
      aggs,
    },
  };
}

function createFilteredAggregation(field, filters, aggs) {
  return {
    [`${field}:${AGGS_WRAPPER_TYPES.FILTERED}`]: {
      filter: filters,
      aggs,
    },
  };
}

function removeFieldFromQuery({ field, query, useIfEmpty = null }) {
  // TODO: must_not? should?
  const musts = get(query, [CONSTANTS.ES_BOOL, CONSTANTS.ES_MUST]) || [];
  const filteredMusts = musts
    .map(must => {
      if (['terms', 'range'].some(key => get(must, [key, field]))) return null;
      const nested = get(must, CONSTANTS.ES_NESTED);
      const nestedQuery = get(nested, CONSTANTS.ES_QUERY);
      if (nestedQuery) {
        const cleaned = removeFieldFromQuery({
          field,
          query: nestedQuery,
        });
        return (
          cleaned && {
            [CONSTANTS.ES_NESTED]: {
              ...nested,
              [CONSTANTS.ES_QUERY]: cleaned,
            },
          }
        );
      } else {
        return must;
      }
    })
    .filter(Boolean);

  if (filteredMusts.length === 0) {
    return useIfEmpty;
  } else {
    return { [CONSTANTS.ES_BOOL]: { [CONSTANTS.ES_MUST]: filteredMusts } };
  }
}

function createNumericAggregation({ field, graphqlField }) {
  const type = [CONSTANTS.STATS, CONSTANTS.HISTOGRAM].find(
    t => graphqlField[t],
  );
  if (!type) {
    return {};
  } else {
    const args = get(graphqlField, [type, 'arguments', 0]) || {};

    return {
      [`${field}:${type}`]: {
        [type]: {
          field,
          ...(type === 'CONSTANTS.HISTOGRAM'
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
  } else if (graphqlField[CONSTANTS.BUCKETS]) {
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
    const cleanedQuery = removeFieldFromQuery({
      field,
      query,
      useIfEmpty: null,
    });
    // TODO: better way to figure out that the field wasn't found
    console.log(query, cleanedQuery);
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
        [`${field}:${AGGS_WRAPPER_TYPES.NESTED}`]: { nested: { path }, aggs },
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
