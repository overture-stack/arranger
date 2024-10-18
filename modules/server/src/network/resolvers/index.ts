import { type GraphQLResolveInfo } from 'graphql';
import { isSuccess } from '../result';
import { NodeConfig } from '../types/types';
import { resolveInfoToMap } from '../util';
import { convertToSqon } from '../utils/sqon';
import { aggregationPipeline } from './aggregations';
import { NetworkNode } from './networkNode';
import { createResponse } from './response';

export type NetworkSearchRoot = {
	nodes: NetworkNode[];
	aggregations: Record<string, unknown>;
};

export type NetworkAggregationArgs = {
	filters?: object;
	aggregations_filter_themselves?: boolean;
	include_missing?: boolean;
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
				// type should match gql typedefs
				args: NetworkAggregationArgs,
				context: unknown,
				info: GraphQLResolveInfo,
			) => {
				const requestedFieldsMap = resolveInfoToMap(info, 'aggregations');

				if ('filters' in args) {
					const result = convertToSqon(args.filters);
					if (!isSuccess(result)) {
						throw new Error(`${result.status} : ${result.message}`);
					}
				}
				const queryVariables = { ...args };

				const { aggregationResults, nodeInfo } = await aggregationPipeline(
					configs,
					requestedFieldsMap,
					queryVariables,
				);
				return createResponse({ aggregationResults, nodeInfo });
			},
		},
	};
};
