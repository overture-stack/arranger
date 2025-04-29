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
 * TODO: Please verify before release.
 * This functionality covers the bare bones of an implementation of data masking.
 * There are areas which needs to be tested more thoroughly and validated to cover potential "data workarounds"
 */

/**
 *
 * 1) Iterate through aggs applying data masking to buckets if applicable
 * 2) Find the agg with the most bucket count and data masking applied to be used in calculating hits.total
 *
 * NB: does not support NumericAggreagtions
 *
 * @param aggregations - aggregations from query
 * @returns aggregations with data masking applied and hits total
 */
export const applyAggregationMasking = ({
	aggregations,
	dataMaskMinThreshold,
}: {
	aggregations: AllAggregationsMap;
	dataMaskMinThreshold: number;
}) => {
	if (dataMaskMinThreshold < 1) {
		throw Error('the value for DATA_MASK_MIN_THRESHOLD must be a positive integer.');
	}
	const THRESHOLD_REPLACEMENT_VALUE = 1;
	console.log(JSON.stringify(aggregations), dataMaskMinThreshold, 'xxxx');
	const { aggsTotal: dataMaskedAggregations, totalHitsAgg } = Object.entries(aggregations).reduce<{
		aggsTotal: AllAggregationsMap;
		totalHitsAgg: { key: string; bucketCount: number };
	}>(
		({ aggsTotal, totalHitsAgg }, [type, aggregation]) => {
			console.log('type', type, 'agg', aggregation);
			// if aggregation is NumericAggregation skip masking as it's not supported yet
			if (aggregation.hasOwnProperty('histogram')) {
				return {
					aggsTotal: {
						...aggsTotal,
						[type]: {
							...aggregation,
						},
					},
					totalHitsAgg,
				};
			}
			// mask buckets if under threshold
			const dataMaskedBuckets = aggregation.buckets.map((bucket) =>
				bucket.doc_count < dataMaskMinThreshold
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
