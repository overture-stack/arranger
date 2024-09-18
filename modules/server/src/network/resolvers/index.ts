import { type GraphQLResolveInfo } from 'graphql';
import { NetworkAggregationConfig, RemoteConnectionData } from '../types';
import { getRequestedFields } from '../util';
import { aggregationPipeline, createNetworkQueries } from './aggregations';
import { createResponse } from './response';

type NetworkSearchRoot = {
	nodes: RemoteConnectionData[];
	aggregations: Record<string, unknown>;
};

/**
 * Create GQL resolvers.
 *
 * It's important to have both remote connection data and aggregations under a single field
 * as remote connection data is dependant on aggregations query
 *
 * @param networkConfigsWithSchemas
 * @param networkFieldTypes
 * @returns
 */
export const createResolvers = (configs: NetworkAggregationConfig[]) => {
	return {
		Query: {
			network: async (
				parent: NetworkSearchRoot,
				args: {},
				context: unknown,
				info: GraphQLResolveInfo,
			) => {
				const { requestedAggregations } = getRequestedFields(info);
				const networkQueries = createNetworkQueries(configs, requestedAggregations);

				// Query remote connections and aggregate results
				const { aggregationResults, nodeInfo } = await aggregationPipeline(
					networkQueries,
					requestedAggregations,
				);
				const response = createResponse({ aggregationResults, nodeInfo });
				console.log('resp', response);
				return response;
			},
		},
	};
};
