import { mergeTypeDefs } from '@graphql-tools/merge';
import { NetworkAggregationConfig } from '../types';
import { createNetworkAggregationTypeDefs } from './aggregations';
import { remoteConnectionTypes } from './remoteConnections';

export const createTypeDefs = (configs: NetworkAggregationConfig[]) => {
	const aggregationTypes = createNetworkAggregationTypeDefs(configs);
	const typeDefs = mergeTypeDefs([remoteConnectionTypes, aggregationTypes]);
	return typeDefs;
};
