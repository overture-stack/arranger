import { SupportedAggregation, SUPPORTED_AGGREGATIONS } from '../common';
import { Aggregations, Bucket, NumericAggregations } from '../types/aggregations';
import { AllAggregations } from '../types/types';
import { RequestedFieldsMap } from '../util';

type NetworkResult = Partial<Record<string, AllAggregations>>;

type ResolveAggregationInput = {
	networkResult: NetworkResult;
	requestedAggregationFields: string[];
	accumulator: AllAggregations;
};

/**
 * Resolves returned aggregations from network queries into single accumulated aggregation
 *
 * @param
 */
const resolveAggregations = ({
	networkResult,
	requestedAggregationFields,
	accumulator,
}: ResolveAggregationInput) => {
	const documentName = Object.keys(networkResult)[0];

	requestedAggregationFields.forEach((fieldName) => {
		const fieldAggregations = networkResult[documentName][fieldName];
		const aggregationType = fieldAggregations.__typename;

		const accumulatedFieldAggregations = accumulator[fieldName];
		const resolvedAggregation = resolveToNetworkAggregation(aggregationType, [
			fieldAggregations,
			accumulatedFieldAggregations,
		]);

		// mutation - updates accumulator
		accumulator[fieldName] = resolvedAggregation;
	});

	return accumulator;
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
): AllAggregations | undefined => {
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
export const resolveAggregation = (aggregations: Aggregations[]): Aggregations => {
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

const emptyAggregation: Aggregations = { bucket_count: 0, buckets: [] };

export class AggregationAccumulator {
	requestedFields: string[];
	totalAgg: AllAggregations;

	constructor(requestedFieldsMap: RequestedFieldsMap) {
		const requestedFields = Object.keys(requestedFieldsMap);
		this.requestedFields = requestedFields;
		/*
		 * seed accumulator with the requested field keys
		 * this will make it easier to add to using key lookup instead of Array.find
		 */
		this.totalAgg = requestedFields.reduce<AllAggregations>((accumulator, field) => {
			return { ...accumulator, [field]: emptyAggregation };
		}, {});
	}

	resolve(data: NetworkResult) {
		resolveAggregations({
			accumulator: this.totalAgg,
			networkResult: data,
			requestedAggregationFields: this.requestedFields,
		});
	}

	result() {
		return this.totalAgg;
	}
}
