import { type Aggregations, type Bucket } from '#mapping/resolveAggregations.js';
import { ALL_NETWORK_AGGREGATION_TYPES_MAP } from '#network/index.js';
import { SUPPORTED_AGGREGATIONS, type SupportedAggregation } from '#network/setup/constants.js';
import { type Hits } from '#network/types/hits.js';
import { type RequestedFieldsMap } from '#network/utils/gql.js';

export type NetworkAggregation = Aggregations & { cardinality: number };
export type NetworkAggregationsMap = Record<string, NetworkAggregation>;

type ResolveAggregationInput = {
	data: { aggregations: NetworkAggregationsMap; hits: Hits };
	accumulator: NetworkAggregationsMap;
	requestedFields: string[];
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
	const existingBucket = computedBuckets.find((bucket) => bucket.key === key);

	if (existingBucket) {
		// update doc_count
		existingBucket.doc_count = existingBucket.doc_count + doc_count;
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
export const resolveAggregation = (aggregations: Partial<NetworkAggregation>[]): NetworkAggregation => {
	return aggregations.reduce<NetworkAggregation>(
		(resolved, agg) => {
			const computedBuckets = resolved.buckets ?? [];
			agg.buckets?.forEach((bucket) => updateComputedBuckets(bucket, computedBuckets));

			const cardinality =
				agg.cardinality !== undefined ? (resolved.cardinality ?? 0) + agg.cardinality : resolved.cardinality;

			return {
				bucket_count: computedBuckets.length,
				buckets: computedBuckets,
				cardinality,
			};
		},
		{ bucket_count: 0, buckets: [], cardinality: 0 },
	);
};

/**
 * Resolve aggregation based on aggregation type
 *
 * @param type
 * @param aggregations
 */
const resolveAggregationByType = <T>(type: string, aggregations: [T, T]): NetworkAggregation => {
	if (type === SUPPORTED_AGGREGATIONS.Aggregations) {
		return resolveAggregation(aggregations as Partial<NetworkAggregation>[]);
	} else {
		// no types match
		throw new Error('No matching aggregation type');
	}
};

// mutation - update a single aggregations field in the accumulator
const addToAccumulator = <T extends NetworkAggregation>({
	existingAggregation,
	aggregation,
	type,
}: {
	existingAggregation: T | undefined;
	aggregation: T;
	type: SupportedAggregation;
}): NetworkAggregation => {
	// if first aggregation, nothing to resolve with yet
	return !existingAggregation ? aggregation : resolveAggregationByType<T>(type, [aggregation, existingAggregation]);
};

const emptyAggregation = (hits: number): NetworkAggregation => ({
	bucket_count: 1,
	buckets: [{ key: '___aggregation_not_available___', doc_count: hits }],
	cardinality: 0,
});

/**
 * Combines returned aggregations from network queries into single accumulated aggregation.
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
			// need to add empty agg for Aggregations type to account for bucket counts and cardinality
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

export class AggregationAccumulator {
	totalAgg: NetworkAggregationsMap = {};
	requestedFields: string[];

	constructor(requestedFieldsMap: RequestedFieldsMap) {
		const requestedFields = Object.keys(requestedFieldsMap);
		this.requestedFields = requestedFields;
	}

	resolve(data: { aggregations: NetworkAggregationsMap; hits: Hits }): void {
		resolveAggregations({
			accumulator: this.totalAgg,
			data: structuredClone(data),
			requestedFields: this.requestedFields,
		});
	}

	result(): NetworkAggregationsMap {
		return this.totalAgg;
	}
}
