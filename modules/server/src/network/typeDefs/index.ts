import { type SupportedNetworkFieldType } from '../setup/fields';
import { createNetworkAggregationTypeDefs } from './aggregations';

export const createTypeDefs = (networkFieldTypes: SupportedNetworkFieldType[]) => {
	const typeDefs = createNetworkAggregationTypeDefs(networkFieldTypes);
	return typeDefs;
};
