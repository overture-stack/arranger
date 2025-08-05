import { ARRANGER_MISSING_DATA_KEY } from '#constants';
import { aggregationsTypenames } from '#shared';

const resolveBuckets = ({ aggregations, gqlTypename }) => {
	switch (gqlTypename) {
		case aggregationsTypenames.Aggregations:
			return aggregations.buckets;
		case aggregationsTypenames.NumericAggregations:
			return aggregations.range.buckets;
		default:
			return [];
	}
};

export const createBarChartTransform =
	({ fieldName, gqlTypename, query }: ChartAggregation) =>
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
