import { get } from 'lodash';
import { HISTOGRAM, STATS, MISSING } from './constants';

function flattenAggregations({ aggregations, includeMissing = true }) {
  return Object.entries(aggregations).reduce((prunedAggs, [key, value]) => {
    const [field, aggregationType = null] = key.split(':');

    if (aggregationType === 'missing') {
      return prunedAggs;
    } else if ([STATS, HISTOGRAM].includes(aggregationType)) {
      return {
        ...prunedAggs,
        [field]: { ...prunedAggs[field], [aggregationType]: value },
      };
    } else if (Array.isArray(value.buckets)) {
      const missing = get(aggregations, [`${field}:missing`]);
      const buckets = [
        ...value.buckets,
        ...(includeMissing && missing && missing.doc_count > 0
          ? [{ ...missing, key: MISSING }]
          : []),
      ];
      const bucket_count = buckets.length;

      return {
        ...prunedAggs,
        [field]: {
          bucket_count,
          buckets: buckets
            .map(({ rn, ...bucket }) => ({
              ...bucket,
              doc_count: rn ? rn.doc_count : bucket.doc_count,
            }))
            .filter((b) => b.doc_count),
        },
      };
    } else {
      return {
        ...prunedAggs,
        ...flattenAggregations({ aggregations: value, includeMissing }),
      };
    }
  }, {});
}

export default flattenAggregations;
