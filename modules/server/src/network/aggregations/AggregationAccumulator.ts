import { Relation } from '@/mapping/masking';
import { ALL_NETWORK_AGGREGATION_TYPES_MAP } from '..';
import { SUPPORTED_AGGREGATIONS } from '../setup/constants';
import { Aggregations, Bucket, NumericAggregations } from '../types/aggregations';
import { Hits } from '../types/hits';
import { AllAggregations } from '../types/types';
import { RequestedFieldsMap } from '../utils/gql';

type ResolveAggregationInput = {
	data: { aggregations: AllAggregations; hits: Hits };
	accumulator: AllAggregations;
	requestedFields: string[];
};

type AggregationsTuple = [Aggregations, Aggregations];
type NumericAggregationsTuple = [NumericAggregations, NumericAggregations];

const emptyAggregation = (hits: number): Aggregations => ({
	bucket_count: 1,
	buckets: [{ key: '___aggregation_not_available___', doc_count: hits, relation: 'eq' }],
});

// mutation - update a single aggregations field in the accumulator
const addToAccumulator = <T extends Aggregations | NumericAggregations>({
	existingAggregation,
	aggregation,
	type,
}: {
	existingAggregation: T | undefined;
	aggregation: T;
	type: SupportedAggregation;
}) => {
	// if first aggregation, nothing to resolve with yet
	return !existingAggregation
		? aggregation
		: resolveToNetworkAggregation<T>(type, [aggregation, existingAggregation]);
};

/**
 * Resolves returned aggregations from network queries into single accumulated aggregation
 * ALL_NETWORK_AGGREGATION_TYPES_MAP should be initialised before using this function
 *
 * @param
 */
const resolveAggregations = ({ data, accumulator, requestedFields }: ResolveAggregationInput) => {
	requestedFields.forEach((requestedField) => {
		const { aggregations, hits } = data;

		/*
		 * requested field will always be in ALL_NETWORK_AGGREGATION_TYPES_MAP
		 * GQL schema validation will throw an error earlier if a requested field isn't in the schema
		 */
		const type = ALL_NETWORK_AGGREGATION_TYPES_MAP.get(requestedField);
		if (type === undefined) {
			console.log(
				'Could not find aggregation type.\nPlease ensure ALL_NETWORK_AGGREGATION_TYPES_MAP is initialised.',
			);
			return;
		}

		const aggregation = aggregations[requestedField];
		const existingAggregation = accumulator[requestedField];

		if (aggregation !== undefined) {
			accumulator[requestedField] = addToAccumulator({
				existingAggregation,
				aggregation,
				type,
			});
		} else {
			// only need to add empty agg for Aggregations type to account for bucket counts
			// histogram => buckets is not supported for NumericAggregations
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
const resolveToNetworkAggregation = <T>(
	type: string,
	aggregations: [T, T],
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
	const { key, doc_count, relation } = bucket;
	const existingBucketIndex = computedBuckets.findIndex((bucket) => bucket.key === key);

	if (existingBucketIndex !== -1) {
		const existingBucket = computedBuckets[existingBucketIndex];
		if (existingBucket) {
			/*
			 * if any of the buckets being processed are "gte" set the bucket relation to "gte"
			 */
			const relationStatus =
				existingBucket.relation === Relation.eq && relation === Relation.gte
					? Relation.gte
					: existingBucket.relation;

			// update existing bucket
			computedBuckets[existingBucketIndex] = {
				...existingBucket,
				doc_count: existingBucket.doc_count + doc_count,
				relation: relationStatus,
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
		return {
			bucket_count: computedBuckets.length,
			buckets: computedBuckets,
			__typename: resolvedAggregation.__typename,
		};
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
