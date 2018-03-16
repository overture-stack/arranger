import { get } from 'lodash';
import { HISTOGRAM, STATS } from './constants';

function flattenAggregations(aggregations) {
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
      const missing = get(aggregations, [`${field}:missing`, 'doc_count']) || 0;
      return {
        ...prunedAggs,
        [field]: {
          buckets: [
            ...value.buckets.map(({ rn, ...bucket }) => ({
              ...bucket,
              doc_count: rn ? rn.doc_count : bucket.doc_count,
            })),
            ...(missing
              ? [
                  {
                    key: '_missing',
                    doc_count: missing,
                  },
                ]
              : []),
          ],
        },
      };
    } else {
      return { ...prunedAggs, ...flattenAggregations(value) };
    }
  }, {});
}

export default flattenAggregations;
