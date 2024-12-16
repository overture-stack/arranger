import { Aggregations } from '@/mapping/resolveAggregations';
import { AggregationAccumulator } from '../aggregations/AggregationAccumulator';
import { failure, isSuccess } from '../result';
import { NodeConfig } from '../setup/query';
import { Hits } from '../types/hits';
import { RequestedFieldsMap } from '../utils/gql';
import { fetchData } from './fetch';
import { createNetworkQuery } from './query';

export const CONNECTION_STATUS = {
	OK: 'OK',
	ERROR: 'ERROR',
} as const;

type QueryVariables = {
	filters?: object;
	aggregations_filter_themselves?: boolean;
	include_missing?: boolean;
};

type SuccessResponse = Record<string, { hits: Hits; aggregations: Aggregations }>;

export type NetworkNode = {
	name: string;
	hits: number;
	status: keyof typeof CONNECTION_STATUS;
	errors: string;
	aggregations: { name: string; type: string }[];
};

/**
 * Query each remote connection
 *
 * @param queries - Query for each remote connection
 * @param requestedAggregationFields - Fields requested
 * @returns Resolved aggregation and node info
 */
export const aggregationPipeline = async (
	configs: NodeConfig[],
	requestedAggregationFields: RequestedFieldsMap,
	queryVariables: QueryVariables,
) => {
	const nodeInfo: NetworkNode[] = [];

	const totalAgg = new AggregationAccumulator(requestedAggregationFields);

	Promise.allSettled(
		configs.map(async (config) => {
			// create node query
			const gqlQuery = createNetworkQuery(config, requestedAggregationFields);

			// query node
			const response = gqlQuery
				? await fetchData<SuccessResponse>({
						url: config.graphqlUrl,
						gqlQuery,
						queryVariables,
				  })
				: failure(CONNECTION_STATUS.ERROR, 'Invalid GQL query');

			const nodeName = config.displayName;

			if (isSuccess(response)) {
				const documentName = config.documentName;
				const responseData = response.data[documentName];
				const aggregations = responseData?.aggregations || {};
				const hits = responseData?.hits || { total: 0 };

				totalAgg.resolve({ aggregations, hits });

				nodeInfo.push({
					name: nodeName,
					hits: hits.total,
					status: CONNECTION_STATUS.OK,
					errors: '',
					aggregations: config.aggregations,
				});
			} else {
				nodeInfo.push({
					name: nodeName,
					hits: 0,
					status: CONNECTION_STATUS.ERROR,
					errors: response?.message || 'Error',
					aggregations: config.aggregations,
				});
			}
		}),
	);

	return { aggregationResults: totalAgg.result(), nodeInfo };
};
