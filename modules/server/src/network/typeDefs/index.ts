import { type SupportedNetworkFieldType } from '../setup/fields.js';
import { createNetworkAggregationTypeDefs } from './aggregations.js';

export const createTypeDefs = (networkFieldTypes: SupportedNetworkFieldType[]) => {
	const typeDefs = createNetworkAggregationTypeDefs(networkFieldTypes);
	return typeDefs;
};
