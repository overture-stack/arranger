import { type Resolver } from '#gqlServer.js';
import { type AggregationsQueryVariables } from '#mapping/resolveAggregations.js';
import { aggregationPipeline, type NetworkNode } from '#network/resolvers/aggregations.js';
import { createResponse } from '#network/resolvers/response.js';
import { isSuccess } from '#network/result.js';
import { type NodeConfig } from '#network/setup/query.js';
import { resolveInfoToMap } from '#network/utils/gql.js';
import { convertToSqon } from '#network/utils/sqon.js';

type NetworkSearchRoot = {
	nodes: NetworkNode[];
	aggregations: Record<string, unknown>;
};

// top level query to pass variables down
export type NetworkQueryVariables = AggregationsQueryVariables;

/**
 * Resolvers for network search.
 *
 * @param networkConfigsWithSchemas
 * @param networkFieldTypes
 * @returns
 */
export const createResolvers = (configs: NodeConfig[]) => {
	const network: Resolver<NetworkSearchRoot, NetworkQueryVariables, any> = async (
		_unusedParentObj,
		args,
		_unusedContext,
		info,
	) => {
		const requestedFieldsMap = resolveInfoToMap(info, 'aggregations');

		/*
		 * Checks validity of SQON
		 * For now we will pass through the non SQON object to the pipeline
		 *
		 * TODO: resolve Arranger / SQONBuilder SQON outer wrapper conflict
		 * {"content": [{...}], "op": "and"}
		 */
		if ('filters' in args) {
			const result = convertToSqon(args.filters);
			if (!isSuccess(result)) {
				throw new Error(`${result.status} : ${result.message}`);
			}
		}
		const queryVariables = { ...args };

		/*
		 * Aggregation pipeline entrypoint
		 */
		const { aggregationResults, nodeInfo } = await aggregationPipeline(configs, requestedFieldsMap, queryVariables);

		return createResponse({ aggregationResults, nodeInfo });
	};

	return {
		Root: {
			network,
		},
	};
};
