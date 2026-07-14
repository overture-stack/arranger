import { ArrangerAggregations, aggregationsTypenames } from '#arranger';
import type { ChartBucket } from './chartsContextTypes';

const ARRANGER_MISSING_DATA_KEY = '__missing__';

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

export const gqlToBuckets = ({ gqlData }: { fieldName: string; gqlData: ArrangerAggregations }): ChartBucket[] => {
	const gqlBuckets = resolveBuckets({ aggregations: gqlData });
	/**
	 * 1 - override label
	 * 2 - put "doc_count" in data agnostic "value"
	 * 3 - map __missing__ key to "No Data"
	 */
	const buckets = gqlBuckets.map(({ key, doc_count }) => ({
		key: key,
		label: key === ARRANGER_MISSING_DATA_KEY ? 'No Data' : key,
		value: doc_count,
	}));

	return buckets;
};
