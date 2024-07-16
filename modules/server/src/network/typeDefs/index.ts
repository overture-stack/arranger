import { mergeTypeDefs } from '@graphql-tools/merge';
import { NetworkFieldType } from '../types';
import { createNetworkAggregationTypeDefs } from './aggregations';
import { remoteConnectionTypes } from './remoteConnections';

export const createTypeDefs = (networkFieldTypes: NetworkFieldType[]) => {
	const aggregationTypes = createNetworkAggregationTypeDefs(networkFieldTypes);
	const typeDefs = mergeTypeDefs([remoteConnectionTypes, aggregationTypes]);
	return typeDefs;
};
