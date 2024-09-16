import { type GraphQLResolveInfo } from 'graphql';
import { resolveAggregations } from '../aggregations';
import { NetworkAggregationConfig, RemoteConnectionData } from '../types';
import { getRootFields } from '../util';
import { createNetworkQueries, queryConnections } from './aggregations';
import { resolveRemoteConnectionNodes } from './remoteConnections';
import { createResponse } from './response';

type NetworkSearchRoot = {
	nodes: RemoteConnectionData[];
	aggregations: Record<string, unknown>;
};

/**
 * Create GQL resolvers.
 * @param networkConfigsWithSchemas
 * @param networkFieldTypes
 * @returns
 */
export const createResolvers = (configs: NetworkAggregationConfig[]) => {
	return {
		Query: {
			nodes: async () => await resolveRemoteConnectionNodes(configs),
			aggregations: async (
				parent: NetworkSearchRoot,
				args: {},
				context: unknown,
				info: GraphQLResolveInfo,
			) => {
				const rootQueryFields = getRootFields(info);
				const networkQueries = createNetworkQueries(configs, rootQueryFields);
				const networkResults = await queryConnections(networkQueries);

				// Aggregate queried data
				const resolvedResults = resolveAggregations(networkResults, rootQueryFields);

				const response = createResponse(resolvedResults);
				return response;
			},
		},
	};
};
