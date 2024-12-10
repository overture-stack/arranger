import { Aggregation } from './types';

/**
 * This returns a total count that is less than or equal to the actual total hits in the query.
 * It is calculated by adding +1 for values under threshold and bucket.doc_count
 * for values greater than or equal to
 *
 * @param aggregation an aggregation with the most buckets which has data masking applied
 * @returns hits total value
 */
const calculateHitsFromAggregation = ({
	aggregation,
}: {
	aggregation: Aggregation | undefined;
}) => {
	if (!aggregation) {
		console.error('No aggregation found for calculating hits.');
		return 0;
	}
	return aggregation.buckets.reduce(
		(totalAcc, bucket) => (bucket.belowThreshold ? totalAcc + 1 : totalAcc + bucket.doc_count),
		0,
	);
};

/**
 *
 * 1) Iterate through aggs applying data masking to buckets if applicable
 * 2) Find the agg with the most bucket count and data masking applied to be used in calculating hits.total
 *
 * @param aggregations - aggregations from query
 * @param thresholdMin - threshold value
 * @returns aggregations with data masking applied and hits total
 */
export const applyAggregationMasking = ({
	aggregations,
	thresholdMin,
}: {
	aggregations: Record<
		string,
		{
			bucket_count: number;
			buckets: Array<{
				doc_count: number;
				key: string;
			}>;
		}
	>;
	thresholdMin: number;
}) => {
	// set data masked properties to one less than the configured threshold value (under threshold)
	const THRESHOLD_REPLACEMENT_VALUE = thresholdMin - 1;

	const { aggsTotal: dataMaskedAggregations, totalHitsAgg } = Object.entries(aggregations).reduce<{
		aggsTotal: Record<string, Aggregation>;
		totalHitsAgg: { key: string; bucketCount: number };
	}>(
		({ aggsTotal, totalHitsAgg }, [type, aggregation]) => {
			// mask buckets if under threshold
			const dataMaskedBuckets = aggregation.buckets.map((bucket) =>
				bucket.doc_count < thresholdMin
					? { ...bucket, doc_count: THRESHOLD_REPLACEMENT_VALUE, belowThreshold: true }
					: { ...bucket, belowThreshold: false },
			);

			// update total hits selected agg if needed
			const bucketIsMasked = dataMaskedBuckets.some((bucket) => bucket.belowThreshold);
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
