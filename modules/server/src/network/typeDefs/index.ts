import { SupportedNetworkFieldType } from '../types/types';
import { createNetworkAggregationTypeDefs } from './aggregations';

export const createTypeDefs = (networkFieldTypes: SupportedNetworkFieldType[]) => {
	const typeDefs = createNetworkAggregationTypeDefs(networkFieldTypes);
	return typeDefs;
};
