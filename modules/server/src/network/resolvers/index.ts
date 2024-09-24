import { type GraphQLResolveInfo } from 'graphql';
import { NetworkConfig } from '../types/setup';
import { resolveInfoToMap } from '../util';
import { aggregationPipeline } from './aggregations';
import { NetworkNode } from './networkNode';
import { createResponse } from './response';

export type NetworkSearchRoot = {
	nodes: NetworkNode[];
	aggregations: Record<string, unknown>;
};

/**
 * Create GQL resolvers.
 *
 * It's important to have both remote connection data and aggregations under a single field
 * as remote connection data is dependant on aggregations query
 *
 * @param networkConfigsWithSchemas
 * @param networkFieldTypes
 * @returns
 */
export const createResolvers = (configs: NetworkConfig[]) => {
	return {
		Query: {
			network: async (
				parent: NetworkSearchRoot,
				args: {},
				context: unknown,
				info: GraphQLResolveInfo,
			) => {
				// const networkQueries = createNetworkQueries(configs, requestedFieldsMap);

				// // Query remote connections and aggregate results
				// const { aggregationResults, nodeInfo } = await aggregationPipeline(
				// 	networkQueries,
				// 	requestedFields,
				// );
				// const response = createResponse({ aggregationResults, nodeInfo });

				const requestedFieldsMap = resolveInfoToMap(info, 'aggregations');

				const { aggregationResults, nodeInfo } = await aggregationPipeline(
					configs,
					requestedFieldsMap,
				);
				const response = createResponse({ aggregationResults, nodeInfo });
				return response;
			},
		},
	};
};
