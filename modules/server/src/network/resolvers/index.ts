import { Resolver } from '@/gqlServer';
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

/*
 * Type should match the "Network" GQL type definition arg types
 */
// TODO: shared?
type NetworkAggregationArgs = {
	filters?: object;
	aggregations_filter_themselves?: boolean;
	include_missing?: boolean;
};

/**
 * Resolvers for network search.
 *
 * It's important to have both remote connection data and aggregations under a single field
 * as remote connection data is dependant on aggregations query
 *
 * @param networkConfigsWithSchemas
 * @param networkFieldTypes
 * @returns
 */
export const createResolvers = (configs: NodeConfig[]) => {
	const network: Resolver<NetworkSearchRoot, NetworkAggregationArgs, any> = async (
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
