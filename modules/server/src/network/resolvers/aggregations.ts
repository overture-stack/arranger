import {
	type AggregationsQueryVariables,
	type AllAggregationsMap,
} from '@/mapping/resolveAggregations';
import { AggregationAccumulator } from '@/network/aggregations/AggregationAccumulator';
import { fetchData } from '@/network/resolvers/fetch';
import { createNetworkQuery } from '@/network/resolvers/query';
import { failure, isSuccess } from '@/network/result';
import { type NodeConfig } from '@/network/setup/query';
import { type Hits } from '@/network/types/hits';
import { RequestedFieldsMap } from '@/network/utils/gql';

export const CONNECTION_STATUS = {
	OK: 'OK',
	ERROR: 'ERROR',
} as const;

export type NetworkNode = {
	name: string;
	hits: number;
	status: keyof typeof CONNECTION_STATUS;
	errors: string;
	aggregations: { name: string; type: string }[];
};

type SuccessResponse = Record<string, { hits: Hits; aggregations: AllAggregationsMap }>;

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
	queryVariables: AggregationsQueryVariables,
) => {
	const nodeInfo: NetworkNode[] = [];

	const totalAgg = new AggregationAccumulator(requestedAggregationFields);

	await Promise.allSettled(
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
