import { NetworkAggregationConfig, NetworkFieldType } from '../types';
import { createAggregationResolvers } from './aggregations';
import { resolveRemoteConnectionNodes } from './remoteConnections';

export const createResolvers = (
	networkConfigsWithSchemas: NetworkAggregationConfig[],
	networkFieldTypes: NetworkFieldType[],
) => {
	const aggregationsResolvers = createAggregationResolvers(
		networkConfigsWithSchemas,
		networkFieldTypes,
	);

	return {
		Query: {
			nodes: async () => await resolveRemoteConnectionNodes(networkConfigsWithSchemas),
			aggregations: () => [], // TODO: Why need array returned? needs some truthy val?
		},
		Aggregations: aggregationsResolvers,
	};
};
