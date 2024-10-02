import { SUPPORTED_AGGREGATIONS } from '../common';
import { Aggregations, Bucket, NumericAggregations } from '../types/aggregations';
import { AllAggregations } from '../types/types';
import { RequestedFieldsMap } from '../util';

type ResolveAggregationInput = {
	aggregationsMap: AllAggregations;
	requestedAggregationFields: string[];
	accumulator: AllAggregations;
};

/**
 * Resolves returned aggregations from network queries into single accumulated aggregation
 *
 * @param
 */
const resolveAggregations = ({
	aggregationsMap,
	requestedAggregationFields,
	accumulator,
}: ResolveAggregationInput) => {
	requestedAggregationFields.forEach((fieldName) => {
		const aggregation = aggregationsMap[fieldName];
		const aggregationType = aggregation?.__typename || '';
		const accumulatedFieldAggregation = accumulator[fieldName];

		if (aggregation && accumulatedFieldAggregation) {
			const resolvedAggregation = resolveToNetworkAggregation(aggregationType, [
				aggregation,
				accumulatedFieldAggregation,
			]);

			// mutation - update a single aggregations field in the accumulator
			accumulator[fieldName] = resolvedAggregation;
		}
	});

	return accumulator;
};

/**
 * Resolve aggregation based on aggregation type
 *
 * @param type
 * @param aggregations
 */
const resolveToNetworkAggregation = (
	type: string,
	aggregations: Aggregations[] | NumericAggregations[],
): Aggregations | NumericAggregations => {
	if (type === SUPPORTED_AGGREGATIONS.Aggregations) {
		return resolveAggregation(aggregations as Aggregations[]);
	} else if (type === SUPPORTED_AGGREGATIONS.NumericAggregations) {
		return resolveNumericAggregation(aggregations as NumericAggregations);
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

	resolve(data: AllAggregations) {
		resolveAggregations({
			accumulator: this.totalAgg,
			aggregationsMap: data,
			requestedAggregationFields: this.requestedFields,
		});
	}

	result() {
		return this.totalAgg;
	}
}
