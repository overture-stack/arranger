import { NetworkAggregationConfig } from '../types';
import { resolveRemoteConnectionNodes } from './remoteConnections';

export const createResolvers = (networkConfigsWithSchemas: NetworkAggregationConfig[]) => ({
	Query: {
		nodes: async () => await resolveRemoteConnectionNodes(networkConfigsWithSchemas),
	},
});
