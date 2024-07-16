import { NetworkAggregationConfig } from '../types';
import { createAggregationResolvers, resolveNetworkAggregations } from './aggregations';
import { resolveRemoteConnectionNodes } from './remoteConnections';

export const createResolvers = (
	networkConfigsWithSchemas: NetworkAggregationConfig[],
	allTypeDefs,
) => ({
	Query: {
		nodes: async () => await resolveRemoteConnectionNodes(networkConfigsWithSchemas),
		//aggregations: async () => await resolveNetworkAggregations(networkConfigsWithSchemas),
		aggregations: createAggregationResolvers(networkConfigsWithSchemas, allTypeDefs),
	},
});
