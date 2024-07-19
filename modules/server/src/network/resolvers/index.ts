import { NetworkAggregationConfig, SupportedNetworkFieldType } from '../types';
import { createAggregationResolvers } from './aggregations';
import { resolveRemoteConnectionNodes } from './remoteConnections';

/**
 * Create GQL resolvers
 * @param networkConfigsWithSchemas
 * @param networkFieldTypes
 * @returns
 */
export const createResolvers = (
	configs: NetworkAggregationConfig[],
	networkFieldTypes: SupportedNetworkFieldType[],
) => {
	const aggregationsResolvers = createAggregationResolvers(configs, networkFieldTypes);

	return {
		Query: {
			nodes: async () => await resolveRemoteConnectionNodes(configs),
			aggregations: () => [], // TODO: Why do we need truthy val returned?
		},
		Aggregations: aggregationsResolvers,
	};
};
