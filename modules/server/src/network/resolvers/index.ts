import { type GraphQLResolveInfo } from 'graphql';
import { NodeConfig } from '../types/types';
import { resolveInfoToMap } from '../util';
import { isSQONFilter } from '../utils/sqon';
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

				try {
					isSQONFilter(args.filters);
				} catch (err) {
					throw `SQON filters are not valid. ${JSON.stringify(err)}`;
				}

				const { aggregationResults, nodeInfo } = await aggregationPipeline(
					configs,
					requestedFieldsMap,
					args,
				);
				return createResponse({ aggregationResults, nodeInfo });
			},
		},
	};
};
