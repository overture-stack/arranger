import { SupportedAggregation, SUPPORTED_AGGREGATIONS } from '../common';
import { Aggregations, NetworkAggregation, NumericAggregations, RemoteAggregation } from '../types';

type NetworkResult = {
	[key: string]: RemoteAggregation;
};

type ResolveAggregationInput = {
	networkResult: NetworkResult;
	requestedAggregationFields: string[];
	accumulator: any;
};

/**
 * Resolves returned aggregations from network queries into single accumulated aggregation
 *
 * @param
 * @returns number - Total bucket count for node
 */
export const resolveAggregations = ({
	networkResult,
	requestedAggregationFields,
	accumulator,
}: ResolveAggregationInput): number => {
	const documentName = Object.keys(networkResult)[0];

	const nodeBucketCount = requestedAggregationFields.reduce((bucketCountAcc, fieldName) => {
		const fieldAggregations = networkResult[documentName][fieldName];
		const fieldBucketCount = fieldAggregations.bucket_count;
		const aggregationType = fieldAggregations.__typename;

		const accumulatedFieldAggregations = accumulator[fieldName];
		const resolvedAggregation = resolveToNetworkAggregation(aggregationType, [
			fieldAggregations,
			accumulatedFieldAggregations,
		]);

		// mutation - updates accumulator
		accumulator[fieldName] = resolvedAggregation;
		// returns total bucket count for node
		return bucketCountAcc + fieldBucketCount;
	}, 0);

	return nodeBucketCount;
};

/**
 * Resolve aggregation based on aggregation type
 *
 * @param type
 * @param aggregations
 */
export const resolveToNetworkAggregation = (
	type: SupportedAggregation,
	aggregations: Aggregations[],
): NetworkAggregation | undefined => {
	if (type === SUPPORTED_AGGREGATIONS.Aggregations) {
		return resolveAggregation(aggregations);
	} else if (type === SUPPORTED_AGGREGATIONS.NumericAggregations) {
		return resolveNumericAggregation(aggregations);
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
const updateComputedBuckets = (bucket, computedBuckets) => {
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
 * Resolves multiple aggregations into single
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
export const resolveAggregation = (aggregations: Aggregations[]): NetworkAggregation => {
	const resolvedAggregation = aggregations.reduce((resolvedAggregation, agg) => {
		const computedBuckets = resolvedAggregation.buckets;
		agg.buckets.forEach((bucket) => updateComputedBuckets(bucket, computedBuckets));
		return { bucket_count: computedBuckets.length, buckets: computedBuckets };
	});

	return resolvedAggregation;
};

const resolveNumericAggregation = (aggregations: NumericAggregations) => {
	// TODO: implement
	throw Error('Not implemented');
};
