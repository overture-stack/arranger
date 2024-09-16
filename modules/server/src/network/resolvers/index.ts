import { type GraphQLResolveInfo } from 'graphql';
import { resolveAggregations } from '../aggregations';
import { NetworkAggregationConfig, RemoteConnectionData } from '../types';
import { getRequestedFields } from '../util';
import { createNetworkQueries, queryConnections } from './aggregations';
import { resolveRemoteConnectionNodes } from './remoteConnections';
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
				const networkResults = await queryConnections(networkQueries);

				// Aggregate query results
				const resolvedResults = resolveAggregations(networkResults, requestedAggregations);

				// Create response
				const response = createResponse(resolvedResults);
				return response;
			},
		},
	};
};
