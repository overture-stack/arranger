import { get } from 'lodash';
import { STATS, HISTOGRAM, BUCKETS, BUCKET_COUNT } from '../constants';

const MAX_AGGREGATION_SIZE = 300000;
const HISTOGRAM_INTERVAL_DEFAULT = 1000;

const createNumericAggregation = ({ type, field, graphqlField }) => {
  const args = get(graphqlField, [type, '__arguments', 0]) || {};
  return {
    [`${field}:${type}`]: {
      [type]: {
        field,
        ...(type === HISTOGRAM
          ? {
              interval: get(args, 'interval.value') || HISTOGRAM_INTERVAL_DEFAULT,
            }
          : {}),
      },
    },
  };
};

const createTermAggregation = ({ field, isNested }) => {
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
};

/**
 * graphqlFields: output from `graphql-fields` (https://github.com/robrichard/graphql-fields)
 */
export default ({ field, graphqlField = {}, isNested = false }) => {
  const types = [BUCKETS, STATS, HISTOGRAM, BUCKET_COUNT].filter((t) => graphqlField[t]);
  return types.reduce((acc, type) => {
    if (type === BUCKETS || type === BUCKET_COUNT) {
      return Object.assign(acc, createTermAggregation({ field, isNested }));
    } else if ([STATS, HISTOGRAM].includes(type)) {
      return Object.assign(acc, createNumericAggregation({ type, field, graphqlField }));
    } else {
      return acc;
    }
  }, {});
};
