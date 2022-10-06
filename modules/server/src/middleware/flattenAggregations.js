import { get } from 'lodash';

import { HISTOGRAM, STATS, MISSING, CARDINALITY } from './constants';

function flattenAggregations({ aggregations, includeMissing = true }) {
  return Object.entries(aggregations).reduce((prunedAggs, [key, value]) => {
    const [fieldName, aggregationType = null] = key.split(':');

    if (aggregationType === 'missing') {
      return prunedAggs;
    } else if ([STATS, HISTOGRAM].includes(aggregationType)) {
      return {
        ...prunedAggs,
        [fieldName]: { ...prunedAggs[fieldName], [aggregationType]: value },
      };
    } else if (CARDINALITY === aggregationType) {
      return {
        ...prunedAggs,
        [fieldName]: { ...prunedAggs[fieldName], [aggregationType]: value.value },
      };
    } else if (Array.isArray(value.buckets)) {
      const missing = get(aggregations, [`${fieldName}:missing`]);
      const buckets = [
        ...value.buckets,
        ...(includeMissing && missing && missing.doc_count > 0
          ? [{ ...missing, key: MISSING }]
          : []),
      ];
      const bucket_count = buckets.length;

      return {
        ...prunedAggs,
        [fieldName]: {
          bucket_count,
          buckets: buckets
            .map(({ rn, ...bucket }) => ({
              ...bucket,
              doc_count: rn ? rn.doc_count : bucket.doc_count,
              ...(bucket[`${fieldName}.hits`]
                ? {
                    top_hits: bucket[`${fieldName}.hits`]?.hits?.hits[0]?._source || {},
                  }
                : {}),
              ...(bucket['term_filters']
                ? {
                    filter_by_term: bucket['term_filters'],
                  }
                : {}),
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
