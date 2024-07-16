import { NetworkAggregationConfig } from '../types';
import { createAggregationResolvers } from './aggregations';
import { resolveRemoteConnectionNodes } from './remoteConnections';

export const createResolvers = (
	networkConfigsWithSchemas: NetworkAggregationConfig[],
	allTypeDefs,
) => {
	const aggregationsResolvers = createAggregationResolvers(networkConfigsWithSchemas, allTypeDefs);

	return {
		Query: {
			nodes: async () => await resolveRemoteConnectionNodes(networkConfigsWithSchemas),
			aggregations: () => [], // TODO: Why need array returned? needs some truthy val?
		},
		Aggregations: aggregationsResolvers,
		NetworkAggregations: {
			test: () => 'working',
		},
	};
};
