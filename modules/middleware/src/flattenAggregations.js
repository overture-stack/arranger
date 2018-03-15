import { CONSTANTS, AGGS_WRAPPER_TYPES } from './constants';

function flattenAggregations(aggregations) {
  return Object.entries(aggregations).reduce((prunedAggs, [key, value]) => {
    if (key === 'doc_count') return prunedAggs;

    const [field, agg_type = null] = key.split(':');

    if (Object.values(AGGS_WRAPPER_TYPES).includes(agg_type)) {
      return { ...prunedAggs, ...flattenAggregations(value) };
    } else if ([CONSTANTS.STATS, CONSTANTS.HISTOGRAM].includes(agg_type)) {
      return {
        ...prunedAggs,
        [field]: { ...prunedAggs[field], [agg_type]: value },
      };
    } else if (Array.isArray(value.buckets)) {
      return {
        ...prunedAggs,
        [field]: {
          ...value,
          buckets: value.buckets.map(({ rn, ...bucket }) => ({
            ...bucket,
            doc_count: rn ? rn.doc_count : bucket.doc_count,
          })),
        },
      };
    } else {
      return { ...prunedAggs, ...flattenAggregations(value) };
    }
  }, {});
}

export default flattenAggregations;
