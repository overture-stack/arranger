import { Resolver } from '@/gqlServer';
import { AggregationsQueryVariables } from '@/mapping/resolveAggregations';
import { isSuccess } from '../result';
import { NodeConfig } from '../setup/query';
import { resolveInfoToMap } from '../utils/gql';
import { convertToSqon } from '../utils/sqon';
import { aggregationPipeline, NetworkNode } from './aggregations';
import { createResponse } from './response';

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
