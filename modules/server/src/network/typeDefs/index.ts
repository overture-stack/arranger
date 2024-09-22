import { mergeTypeDefs } from '@graphql-tools/merge';
import { SupportedNetworkFieldType } from '../types/types';
import { createNetworkAggregationTypeDefs } from './aggregations';
import { remoteConnectionTypes } from './remoteConnections';

export const createTypeDefs = (networkFieldTypes: SupportedNetworkFieldType[]) => {
	const aggregationTypes = createNetworkAggregationTypeDefs(networkFieldTypes);
	const typeDefs = mergeTypeDefs([remoteConnectionTypes, aggregationTypes]);
	return typeDefs;
};
