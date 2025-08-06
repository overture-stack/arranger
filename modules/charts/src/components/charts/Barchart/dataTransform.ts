import { GQLDataMap } from '#components/Provider/Provider';
import { ARRANGER_MISSING_DATA_KEY } from '#constants';
import { aggregationsTypenames, ArrangerAggregations } from '#shared';
import { ChartConfig } from './useValidateInput';

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
			return aggregations.range?.buckets;
		default:
			return [];
	}
};

/**
 * Creates a data transformation function for converting GraphQL responses to bar chart format.
 * Returns a configured transformer that handles missing data and applies custom transformations.
 *
 * @param { fieldName } - GraphQL field name being queried
 * @param { gqlTypename } - Type of GraphQL aggregation
 * @param { query } - Query configuration with optional transform function
 * @returns Function that transforms GraphQL data to chart format
 */
export const createBarChartTransform =
	({ fieldName, gqlTypename, query }: ChartConfig) =>
	({ gqlData }: { gqlData: GQLDataMap }): ChartData | null => {
		if (!gqlData) {
			return null;
		}

		const aggregations = gqlData[fieldName];

		const gqlBuckets = resolveBuckets({ aggregations, gqlTypename });
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

		return (query?.transformData && query.transformData(buckets)) || buckets;
	};
