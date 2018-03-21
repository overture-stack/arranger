import { HISTOGRAM, STATS } from './constants';

function flattenAggregations(aggregations) {
  return Object.entries(aggregations).reduce((prunedAggs, [key, value]) => {
    const [field, aggregationType = null] = key.split(':');

    if ([STATS, HISTOGRAM].includes(aggregationType)) {
      return {
        ...prunedAggs,
        [field]: { ...prunedAggs[field], [aggregationType]: value },
      };
    } else if (Array.isArray(value.buckets)) {
      return {
        ...prunedAggs,
        [field]: {
          buckets: [
            ...value.buckets.map(({ rn, ...bucket }) => ({
              ...bucket,
              doc_count: rn ? rn.doc_count : bucket.doc_count,
            })),
          ],
        },
      };
    } else {
      return { ...prunedAggs, ...flattenAggregations(value) };
    }
  }, {});
}

export default flattenAggregations;
