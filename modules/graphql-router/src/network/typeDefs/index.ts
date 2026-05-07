import { type SupportedAggregationField } from '../setup/fields.js';
import { createNetworkAggregationTypeDefs } from './aggregations.js';

export const createTypeDefs = (networkFieldTypes: SupportedAggregationField[]) => {
	const typeDefs = createNetworkAggregationTypeDefs(networkFieldTypes);
	return typeDefs;
};
