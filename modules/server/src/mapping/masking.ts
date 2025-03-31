import { ENV_CONFIG } from '#config/index.js';
import { type Aggregations, type AllAggregationsMap } from './resolveAggregations.js';

export const Relation = {
	eq: 'eq',
	gte: 'gte',
} as const;

export type Relation = keyof typeof Relation;

/**
 * Returns a total count that is less than or equal to the actual total hits in the query
 * It is calculated by adding +1 for values under threshold or adding bucket.doc_count amount
 * for values greater than or equal to
 *
 * @param aggregation an aggregation with the most buckets which has data masking applied
 * @returns hits total value
 */
const calculateHitsFromAggregation = ({ aggregation }: { aggregation: Aggregations | undefined }) => {
	if (!aggregation) {
		console.error('No aggregation found for calculating hits.');
		return 0;
	}
	return aggregation.buckets.reduce(
		(totalAcc, bucket) => (bucket.relation === Relation.gte ? totalAcc + 1 : totalAcc + bucket.doc_count),
		0,
	);
};

/**
 *
 * 1) Iterate through aggs applying data masking to buckets if applicable
 * 2) Find the agg with the most bucket count and data masking applied to be used in calculating hits.total
 *
 * @param aggregations - aggregations from query
 * @returns aggregations with data masking applied and hits total
 */
export const applyAggregationMasking = ({ aggregations }: { aggregations: AllAggregationsMap }) => {
	const thresholdMin = ENV_CONFIG.DATA_MASK_MIN_THRESHOLD;
	if (thresholdMin < 1) {
		throw Error('DATA_MASK_MIN_THRESHOLD environment variable has to be a positive integer.');
	}
	const THRESHOLD_REPLACEMENT_VALUE = 1;

	const { aggsTotal: dataMaskedAggregations, totalHitsAgg } = Object.entries(aggregations).reduce<{
		aggsTotal: AllAggregationsMap;
		totalHitsAgg: { key: string; bucketCount: number };
	}>(
		({ aggsTotal, totalHitsAgg }, [type, aggregation]) => {
			// mask buckets if under threshold
			const dataMaskedBuckets = aggregation.buckets.map((bucket) =>
				bucket.doc_count < thresholdMin
					? { ...bucket, doc_count: THRESHOLD_REPLACEMENT_VALUE, relation: Relation.gte }
					: { ...bucket, relation: Relation.eq },
			);

			// update total hits selected agg if needed
			const bucketIsMasked = dataMaskedBuckets.some((bucket) => bucket.relation === Relation.gte);
			// take aggregation with the most buckets that has masked data
			const hitsAgg =
				totalHitsAgg.bucketCount < aggregation.bucket_count && bucketIsMasked
					? { key: type, bucketCount: aggregation.bucket_count }
					: totalHitsAgg;

			return {
				aggsTotal: {
					...aggsTotal,
					[type]: {
						...aggregation,
						buckets: dataMaskedBuckets,
					},
				},
				totalHitsAgg: hitsAgg,
			};
		},
		{
			aggsTotal: {},
			totalHitsAgg: { key: '', bucketCount: 0 },
		},
	);

	const hitsTotal = calculateHitsFromAggregation({
		aggregation: dataMaskedAggregations[totalHitsAgg.key],
	});

	return { hitsTotal, dataMaskedAggregations };
};
