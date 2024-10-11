import { type GraphQLResolveInfo } from 'graphql';
import { NetworkFields } from '../setup/fields';
import { NetworkConfig } from '../types/setup';
import { NodeConfig } from '../types/types';
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
export const createResolvers = (configs: NodeConfig[]) => {
	return {
		Query: {
			network: async (
				parent: NetworkSearchRoot,
				args: Record<string, unknown>,
				context: unknown,
				info: GraphQLResolveInfo,
			) => {
				const requestedFieldsMap = resolveInfoToMap(info, 'aggregations');

				const { aggregationResults, nodeInfo } = await aggregationPipeline(
					configs,
					requestedFieldsMap,
					args,
				);
				const response = createResponse({ aggregationResults, nodeInfo });
				return response;
			},
		},
	};
};
