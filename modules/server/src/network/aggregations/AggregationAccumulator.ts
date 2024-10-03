import { SUPPORTED_AGGREGATIONS } from '../common';
import { Aggregations, Bucket, NumericAggregations } from '../types/aggregations';
import { AllAggregations } from '../types/types';

type ResolveAggregationInput = {
	aggregationsMap: AllAggregations;
	accumulator: AllAggregations;
};

type AggregationsTuple = [Aggregations, Aggregations];
type NumericAggregationsTuple = [NumericAggregations, NumericAggregations];

/**
 * Resolves returned aggregations from network queries into single accumulated aggregation
 *
 * @param
 */
const resolveAggregations = ({ aggregationsMap, accumulator }: ResolveAggregationInput) => {
	Object.keys(aggregationsMap).forEach((fieldName) => {
		const aggregation = aggregationsMap[fieldName];
		const aggregationType = aggregation?.__typename || '';

		const accumulatedFieldAggregation = accumulator[fieldName];

		// mutation - update a single aggregations field in the accumulator
		// if first aggregation, nothing to resolve yet
		accumulator[fieldName] = !accumulatedFieldAggregation
			? aggregation
			: resolveToNetworkAggregation(aggregationType, [aggregation, accumulatedFieldAggregation]);
	});
};

/**
 * Resolve aggregation based on aggregation type
 *
 * @param type
 * @param aggregations
 */
const resolveToNetworkAggregation = (
	type: string,
	aggregations: AggregationsTuple | NumericAggregationsTuple,
): Aggregations | NumericAggregations => {
	if (type === SUPPORTED_AGGREGATIONS.Aggregations) {
		return resolveAggregation(aggregations as AggregationsTuple);
	} else if (type === SUPPORTED_AGGREGATIONS.NumericAggregations) {
		return resolveNumericAggregation(aggregations as NumericAggregationsTuple);
	} else {
		// no types match
		throw Error('No matching aggregation type');
	}
};

/**
 * Mutation
 * Updates existing or adds additional bucket to computed buckets
 *
 * @param bucket - Bucket being processed
 * @param computedBuckets - Existing buckets
 */
const updateComputedBuckets = (bucket: Bucket, computedBuckets: Bucket[]) => {
	/*
	 * Unable to use lookup key eg. buckets[key]
	 * "buckets": [
	 *  {
	 *    "doc_count": 140,
	 *    "key": "Dog"
	 *   },
	 */
	const { key, doc_count } = bucket;
	const existingBucketIndex = computedBuckets.findIndex((bucket) => bucket.key === key);
	if (existingBucketIndex !== -1) {
		const existingBucket = computedBuckets[existingBucketIndex];
		if (existingBucket) {
			// update existing bucket
			computedBuckets[existingBucketIndex] = {
				...existingBucket,
				doc_count: existingBucket.doc_count + doc_count,
			};
		}
	} else {
		computedBuckets.push(bucket);
	}
};

/**
 * Resolves multiple aggregations into single aggregation
 * eg. donors_gender aggregation from multiple nodes into a single aggregation
 *
 * @param aggregations
 * @returns
 *
 * @example
 * #### Input
 * ```javascript
 *[
 * {
 *	bucket_count: 2,
 *	buckets: [
 *		{
 *			key: 'Male',
 *			doc_count: 15,
 *		},
 *		{
 *			key: 'Female',
 *			doc_count: 700,
 *		},
 *		{
 *			key: 'Unknown',
 *			doc_count: 5,
 *		},
 *	],
 *	},
 * {
 * 	bucket_count: 2,
 * 	buckets: [
 * 		{
 * 			key: 'Male',
 * 			doc_count: 25,
 * 		},
 * 		{
 * 			key: 'Female',
 * 			doc_count: 100,
 * 		},
 * 	],
 * }];
 * ```
 *
 * #### Output
 * ```javascript
 * {
 *  bucket_count: 3,
 *  	buckets: [
 *  		{
 *  			key: 'Male',
 *  			doc_count: 40,
 *  		},
 *  		{
 *  			key: 'Female',
 *  			doc_count: 800,
 *  		},
 *  		{
 *  			key: 'Unknown',
 *  			doc_count: 5,
 *  		}]
 *	}
 * ```
 */
export const resolveAggregation = (aggregations: AggregationsTuple): Aggregations => {
	const resolvedAggregation = aggregations.reduce((resolvedAggregation, agg) => {
		const computedBuckets = resolvedAggregation.buckets;
		agg.buckets.forEach((bucket) => updateComputedBuckets(bucket, computedBuckets));
		return { bucket_count: computedBuckets.length, buckets: computedBuckets };
	});

	return resolvedAggregation;
};

const resolveNumericAggregation = (aggregations: NumericAggregationsTuple): NumericAggregations => {
	const resolvedAggregation = aggregations.reduce((resolvedAggregation, agg) => {
		// max
		if (agg.stats.max > resolvedAggregation.stats.max) {
			resolvedAggregation.stats.max = agg.stats.max;
		}
		// min
		if (agg.stats.min < resolvedAggregation.stats.min) {
			resolvedAggregation.stats.min = agg.stats.min;
		}
		// count
		resolvedAggregation.stats.count += agg.stats.count;
		// sum
		resolvedAggregation.stats.sum += agg.stats.sum;
		// avg
		resolvedAggregation.stats.avg = resolvedAggregation.stats.sum / resolvedAggregation.stats.count;

		return resolvedAggregation;
	});
	return resolvedAggregation;
};

export class AggregationAccumulator {
	totalAgg: AllAggregations = {};

	resolve(data: AllAggregations) {
		resolveAggregations({
			accumulator: this.totalAgg,
			aggregationsMap: structuredClone(data),
		});
	}

	result() {
		return this.totalAgg;
	}
}
