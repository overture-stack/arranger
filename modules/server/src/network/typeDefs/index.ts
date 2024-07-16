import { mergeTypeDefs } from '@graphql-tools/merge';
import { createNetworkAggregationTypeDefs } from './aggregations';
import { remoteConnectionTypes } from './remoteConnections';

export const createTypeDefs = (allTypeDefs) => {
	const aggregationTypes = createNetworkAggregationTypeDefs(allTypeDefs);
	const typeDefs = mergeTypeDefs([remoteConnectionTypes, aggregationTypes]);
	return typeDefs;
};
