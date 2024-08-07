import { type GraphQLResolveInfo } from 'graphql';
import { resolveAggregations } from '../aggregations';
import { NetworkAggregationConfig, RemoteConnectionData } from '../types';
import { createNetworkQueries, queryConnections } from './aggregations';
import { resolveRemoteConnectionNodes } from './remoteConnections';

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
				const networkQueries = createNetworkQueries(configs, info);
				const networkResults = await queryConnections(networkQueries);
				// TODO: implement aggregating
				const resolvedResults = resolveAggregations(networkResults);
				return resolvedResults;
			},
		},
	};
};
