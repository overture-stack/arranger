import { type AggregationsQueryVariables, type AllAggregationsMap } from '#mapping/resolveAggregations.js';
import { AggregationAccumulator } from '#network/aggregations/AggregationAccumulator.js';
import { fetchData } from '#network/resolvers/fetch.js';
import { createNetworkQuery } from '#network/resolvers/query.js';
import { type Hits } from '#network/types/hits.js';
import type { NetworkRemoteNode } from '#network/types/setup.js';
import type { RequestedFieldsMap } from '#network/utils/gql.js';

export const CONNECTION_STATUS = {
	OK: 'OK',
	ERROR: 'ERROR',
} as const;

export type NetworkNodeResponseData = {
	name: string;
	hits: number;
	status: keyof typeof CONNECTION_STATUS;
	errors: string;
	aggregations: { name: string; type: string }[];
};

type SuccessResponse = Record<string, { hits: Hits; aggregations: AllAggregationsMap }>;

/**
 * Query each network node then combine the results into total aggregations.
 * This will also return the total hits for each node separate from the aggregations.
 *
 * @param queries - Query for each remote connection
 * @param requestedAggregationFields - Fields requested
 * @returns Resolved aggregation and node info
 */
export const aggregationPipeline = async (
	configs: NetworkRemoteNode[], // TODO: Allow local nodes as well
	requestedAggregationFields: RequestedFieldsMap,
	queryVariables: AggregationsQueryVariables,
): Promise<{
	aggregationResults: AllAggregationsMap;
	nodeInfo: Omit<NetworkNodeResponseData, 'aggregations'>[];
}> => {
	const nodeInfo: Omit<NetworkNodeResponseData, 'aggregations'>[] = [];

	const totalAgg = new AggregationAccumulator(requestedAggregationFields);

	await Promise.allSettled(
		configs.map(async (config) => {
			// create node query
			const gqlQueryResult = createNetworkQuery(config, requestedAggregationFields);
			if (!gqlQueryResult.success) {
				return gqlQueryResult;
			}

			// query node
			const gqlQuery = gqlQueryResult.data;
			const response = await fetchData<SuccessResponse>({
				url: config.graphqlUrl,
				gqlQuery,
				queryVariables,
			});

			const nodeName = config.displayName;

			if (response.success) {
				const documentName = config.documentType;
				const responseData = response.data[documentName];
				const aggregations = responseData?.aggregations || {};
				const hits = responseData?.hits || { total: 0 };

				totalAgg.resolve({ aggregations, hits });

				nodeInfo.push({
					name: nodeName,
					hits: hits.total,
					status: CONNECTION_STATUS.OK,
					errors: '',
				});
			} else {
				nodeInfo.push({
					name: nodeName,
					hits: 0,
					status: CONNECTION_STATUS.ERROR,
					errors: response.data ?? 'Error',
				});
			}
		}),
	);

	return { aggregationResults: totalAgg.result(), nodeInfo };
};
