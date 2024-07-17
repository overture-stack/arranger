import { NetworkAggregationConfig, NetworkFieldType } from '../types';
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
	networkFieldTypes: NetworkFieldType[],
) => {
	const aggregationsResolvers = createAggregationResolvers(configs, networkFieldTypes);

	return {
		Query: {
			nodes: async () => await resolveRemoteConnectionNodes(configs),
			aggregations: () => [], // TODO: Why need array returned? needs some truthy val?
		},
		Aggregations: aggregationsResolvers,
	};
};
