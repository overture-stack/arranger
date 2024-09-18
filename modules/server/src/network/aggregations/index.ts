import { SupportedAggregation, SUPPORTED_AGGREGATIONS } from '../common';
import { Aggregations, NetworkAggregation, NumericAggregations, RemoteAggregation } from '../types';

/**
 * Pick each field from network result aggregations and reduce into single aggregation
 *
 * @param networkResult
 * @param accumulator
 */

type NetworkResult = {
	[key: string]: RemoteAggregation;
};
export const resolveAggregations = ({
	networkResult,
	requestedAggregationFields,
	accumulator,
}: {
	networkResult: NetworkResult;
	requestedAggregationFields: string[];
	accumulator: any;
}) => {
	// TODO: get documentName somewhere else, [0] isn't guaranteed
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

		// mutation - update accumulator
		accumulator[fieldName] = resolvedAggregation;
		// return { fieldName: fieldName, aggregation: resolvedAggregation };
		return bucketCountAcc + fieldBucketCount;
	}, 0);

	return nodeBucketCount;
};

/**
 * Resolve aggregation based on aggregation type
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
 * Takes an array of the same aggregation type and computes the singular type
 * eg. NumericAggregation => NetworkNumericAggregation
 *
 * Note for operations on Buckets -  the size of the array can be large (e.g. total bucket count), complicating lookups, etc.
 *
 * @param aggregations
 * @returns
 */
export const resolveAggregation = (aggregations: Aggregations[]): NetworkAggregation => {
	const resolvedAggregation = aggregations.reduce((resolvedAggregation, agg) => {
		/*
		 * Unable to use lookup key eg. buckets[key]
		 * "buckets": [
		 *  {
		 *    "doc_count": 140,
		 *    "key": "Dog"
		 *   },
		 */
		const computedBuckets = resolvedAggregation.buckets;

		// TODO: extract
		agg.buckets.forEach((bucket) => {
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
		});
		return { bucket_count: computedBuckets.length, buckets: computedBuckets };
	});

	return resolvedAggregation;
};

const resolveNumericAggregation = (aggregations: NumericAggregations) => {
	// TODO: implement
	throw Error('Not implemented');
};
