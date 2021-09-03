import { get } from 'lodash';
import { STATS, HISTOGRAM, BUCKETS, BUCKET_COUNT, CARDINALITY, TOPHITS } from '../constants';
import isEmpty from 'lodash/isEmpty';
import { opSwitch } from '../buildQuery';
import normalizeFilters from '../buildQuery/normalizeFilters';

const MAX_AGGREGATION_SIZE = 300000;
const HISTOGRAM_INTERVAL_DEFAULT = 1000;
const CARDINALITY_DEFAULT_PRECISION_THRESHOLD = 40000; // max precision for ES6-7

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

const createTermAggregation = ({ field, isNested, graphqlField }) => {
  const maxAggregations = get(
    graphqlField,
    ['buckets', '__arguments', 0, 'max', 'value'],
    MAX_AGGREGATION_SIZE,
  );
  const termFilter = graphqlField?.buckets?.filter_by_term || null;
  const topHits = graphqlField?.buckets?.top_hits || null;
  const source = topHits?.__arguments[0]?._source || null;
  const size = topHits?.__arguments[1]?.size || 1;

  let innerAggs = {};
  if (isNested) {
    innerAggs = { ...innerAggs, rn: { reverse_nested: {} } };
  }
  if (topHits) {
    innerAggs = {
      ...innerAggs,
      [`${field}.hits`]: {
        top_hits: {
          _source: source?.value || [],
          size: size?.value,
        },
      },
    };
  }

  if (termFilter) {
    const terms = termFilter.__arguments[0]?.filter?.value || [];

    const aggsFilters = terms.content.map((sqonFilter) =>
      opSwitch({
        nestedFields: [],
        filter: normalizeFilters(sqonFilter),
      }),
    );

    innerAggs = {
      ...innerAggs,
      ...(terms
        ? {
            term_filters: {
              filter: {
                bool: {
                  must: aggsFilters,
                },
              },
            },
          }
        : {}),
    };
  }

  return {
    [field]: {
      ...(!isEmpty(innerAggs) ? { aggs: { ...innerAggs } } : {}),
      terms: { field, size: maxAggregations },
    },
    [`${field}:missing`]: {
      ...(isNested ? { aggs: { rn: { reverse_nested: {} } } } : {}),
      missing: { field: field },
    },
  };
};

const getPrecisionThreshold = (graphqlField) => {
  const args = get(graphqlField, [CARDINALITY, '__arguments', 0], {});
  return args?.precision_threshold?.value || CARDINALITY_DEFAULT_PRECISION_THRESHOLD;
};

const computeCardinalityAggregation = ({ field, graphqlField }) => ({
  [`${field}:${CARDINALITY}`]: {
    cardinality: {
      field,
      precision_threshold: getPrecisionThreshold(graphqlField),
    },
  },
});

/**
 * graphqlFields: output from `graphql-fields` (https://github.com/robrichard/graphql-fields)
 */
export default ({ field, graphqlField = {}, isNested = false }) => {
  const types = [BUCKETS, STATS, HISTOGRAM, BUCKET_COUNT, CARDINALITY, TOPHITS].filter(
    (t) => graphqlField[t],
  );
  return types.reduce((acc, type) => {
    if (type === BUCKETS || type === BUCKET_COUNT) {
      return Object.assign(acc, createTermAggregation({ field, isNested, graphqlField }));
    } else if ([STATS, HISTOGRAM].includes(type)) {
      return Object.assign(acc, createNumericAggregation({ type, field, graphqlField }));
    } else if (type === CARDINALITY) {
      return Object.assign(acc, computeCardinalityAggregation({ type, field, graphqlField }));
    } else {
      return acc;
    }
  }, {});
};
