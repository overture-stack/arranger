import { GQLDataMap } from '#components/Provider/Provider';
import { ARRANGER_MISSING_DATA_KEY } from '#constants';
import { aggregationsTypenames, ArrangerAggregations } from '#shared';

/**
 * Resolves GraphQL aggregation buckets based on the aggregation type.
 * Handles different GraphQL response structures for categorical vs numeric data.
 *
 * @param { aggregations } - GraphQL aggregation response object
 * @param { gqlTypename } - Type of GraphQL aggregation (Aggregations | NumericAggregations)
 * @returns Array of bucket objects with key and doc_count properties
 */
const resolveBuckets = ({ aggregations }: { aggregations: ArrangerAggregations }) => {
	switch (aggregations.__typename) {
		case aggregationsTypenames.Aggregations:
			return aggregations.buckets;
		case aggregationsTypenames.NumericAggregations:
			return aggregations.range?.buckets || [];
		default:
			return [];
	}
};

export const gqlToBuckets = ({ gqlData }: { fieldName: string; gqlData: GQLDataMap }): ChartData | null => {
	if (!gqlData) {
		return null;
	}

	const gqlBuckets = resolveBuckets({ aggregations: gqlData });
	/**
	 * 1 - add displayKey property
	 * 2 - rename doc_count to docCount
	 * 3 - map __missing__ key to "No Data"
	 */
	const buckets = gqlBuckets.map(({ key, doc_count }) => ({
		key: key,
		displayKey: key === ARRANGER_MISSING_DATA_KEY ? 'No Data' : key,
		docCount: doc_count,
	}));

	return buckets;
};
