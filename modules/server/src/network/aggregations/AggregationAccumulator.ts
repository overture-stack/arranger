import { ALL_NETWORK_AGGREGATION_TYPES_MAP } from '..';
import { SUPPORTED_AGGREGATIONS } from '../common';
import { Aggregations, Bucket, NumericAggregations } from '../types/aggregations';
import { Hits } from '../types/hits';
import { AllAggregations } from '../types/types';
import { RequestedFieldsMap } from '../util';

type ResolveAggregationInput = {
	data: { aggregations: AllAggregations; hits: Hits };
	accumulator: AllAggregations;
	requestedFields: string[];
};

type AggregationsTuple = [Aggregations, Aggregations];
type NumericAggregationsTuple = [NumericAggregations, NumericAggregations];

const emptyAggregation = (hits: number) => ({
	bucket_count: 1,
	buckets: [{ key: '___aggregation_not_available___', doc_count: hits }],
});

// mutation - update a single aggregations field in the accumulator
const addToAccumulator = ({ existingAggregation, aggregation, type }) => {
	// if first aggregation, nothing to resolve with yet
	return !existingAggregation
		? aggregation
		: resolveToNetworkAggregation(type, [aggregation, existingAggregation]);
};

/**
 * Resolves returned aggregations from network queries into single accumulated aggregation
 *
 * @param
 */
const resolveAggregations = ({ data, accumulator, requestedFields }: ResolveAggregationInput) => {
	requestedFields.forEach((requestedField) => {
		const { aggregations, hits } = data;

		const isFieldAvailable = !!aggregations[requestedField];
		//
		const type = ALL_NETWORK_AGGREGATION_TYPES_MAP.get(requestedField);
		const existingAggregation = accumulator[requestedField];
		console.log('req', requestedField, type);

		if (isFieldAvailable) {
			accumulator[requestedField] = addToAccumulator({
				existingAggregation,
				aggregation: aggregations[requestedField],
				type,
			});
		} else {
			///
			if (type === SUPPORTED_AGGREGATIONS.Aggregations) {
				accumulator[requestedField] = addToAccumulator({
					existingAggregation,
					aggregation: emptyAggregation(hits.total),
					type,
				});
			}
		}
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
	return aggregations.reduce((resolvedAggregation, agg) => {
		// max
		resolvedAggregation.stats.max = Math.max(agg.stats.max, resolvedAggregation.stats.max);

		// min
		resolvedAggregation.stats.min = Math.min(agg.stats.min, resolvedAggregation.stats.min);

		// count
		resolvedAggregation.stats.count += agg.stats.count;
		// sum
		resolvedAggregation.stats.sum += agg.stats.sum;
		// avg
		resolvedAggregation.stats.avg = resolvedAggregation.stats.sum / resolvedAggregation.stats.count;

		return resolvedAggregation;
	});
};

export class AggregationAccumulator {
	totalAgg: AllAggregations = {};
	requestedFields: string[];

	constructor(requestedFieldsMap: RequestedFieldsMap) {
		const requestedFields = Object.keys(requestedFieldsMap);
		this.requestedFields = requestedFields;
	}

	resolve(data: { aggregations: AllAggregations; hits: Hits }) {
		resolveAggregations({
			accumulator: this.totalAgg,
			data: structuredClone(data),
			requestedFields: this.requestedFields,
		});
	}

	result() {
		return this.totalAgg;
	}
}
