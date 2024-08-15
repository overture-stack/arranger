import { SupportedAggregation, SUPPORTED_AGGREGATIONS } from '../common';
import { Aggregations, NetworkAggregation, NumericAggregations } from '../types';

/**
 * Pick each field from network result aggregations and reduce into single aggregation
 *
 * @param networkResults
 * @param rootQueryFields
 */
export const resolveAggregations = (networkResults, rootQueryFields) => {
	const resolvedNetworkAggregations = rootQueryFields.map((fieldName) => {
		const fieldAggregations = networkResults.map((networkResult) => {
			const documentName = Object.keys(networkResult)[0];
			return networkResult[documentName][fieldName];
		});
		const aggregationType = fieldAggregations[0].__typename;
		const resolvedAggregation = resolveToNetworkAggregation(aggregationType, fieldAggregations);
		return { fieldName: fieldName, aggregation: resolvedAggregation };
	});

	return resolvedNetworkAggregations;
};

/**
 * Resolve aggregation based on aggregation type
 * @param type
 * @param aggregations
 */
export const resolveToNetworkAggregation = (
	type: SupportedAggregation,
	aggregations: Aggregations[],
) => {
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
 * @param aggregations
 * @returns
 */
export const resolveAggregation = (aggregations: Aggregations[]): NetworkAggregation => {
	const emptyAggregation: NetworkAggregation = { bucket_count: 0, buckets: [] };

	const resolvedAggregation = aggregations.reduce((resolvedAggregation, agg) => {
		const computedBucketCount = resolvedAggregation.bucket_count + agg.bucket_count;
		const computedBuckets = agg.buckets.map(({ key, doc_count }) => {
			// potentially expensive "find" if array of buckets is very large
			const bucket = resolvedAggregation.buckets.find((bucket) => bucket.key === key);
			return { key, doc_count: (bucket?.doc_count || 0) + doc_count };
		});
		return { bucket_count: computedBucketCount, buckets: computedBuckets };
	}, emptyAggregation);
	return resolvedAggregation;
};

const resolveNumericAggregation = (aggregations: NumericAggregations) => {
	// TODO: implement
	throw Error('Not implemented');
};
