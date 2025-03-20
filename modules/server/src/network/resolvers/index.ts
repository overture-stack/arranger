import { type Resolver } from '@/gqlServer';
import { type AggregationsQueryVariables } from '@/mapping/resolveAggregations';
import { aggregationPipeline, type NetworkNode } from '@/network/resolvers/aggregations';
import { createResponse } from '@/network/resolvers/response';
import { isSuccess } from '@/network/result';
import { type NodeConfig } from '@/network/setup/query';
import { resolveInfoToMap } from '@/network/utils/gql';
import { convertToSqon } from '@/network/utils/sqon';

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
		const { aggregationResults, nodeInfo } = await aggregationPipeline(
			configs,
			requestedFieldsMap,
			queryVariables,
		);

		return createResponse({ aggregationResults, nodeInfo });
	};

	return {
		Root: {
			network,
		},
	};
};
