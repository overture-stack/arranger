import type { NodeConfig } from '@overture-stack/arranger-types/configs';

import { type Resolver } from '#gqlServer.js';
import type { ArrangerBaseContext } from '#graphqlRoutes.js';
import { type AggregationsQueryVariables } from '#mapping/resolveAggregations.js';
import {
	aggregationPipeline,
	CONNECTION_STATUS,
	type NetworkNodeResponseData,
} from '#network/resolvers/aggregations.js';
import { createResponse } from '#network/resolvers/response.js';
import { resolveInfoToMap } from '#network/utils/gql.js';
import { convertToSqon } from '#network/utils/sqon.js';

import type { NetworkLocalNode, NetworkRemoteNode } from '../types/setup.js';

type NetworkSearchRoot = {
	nodes: NetworkNodeResponseData[];
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
export const createResolvers = <Context extends ArrangerBaseContext>(params: {
	remoteNodes: {
		connected: NetworkRemoteNode[];
		failed: { config: NodeConfig; error: string }[];
	};
	localNodes: NetworkLocalNode<Context>[];
}) => {
	const { localNodes, remoteNodes } = params;
	const failedNodeInfo: NetworkNodeResponseData[] = remoteNodes.failed.map(({ config, error }) => ({
		name: config.displayName,
		hits: 0,
		status: CONNECTION_STATUS.ERROR,
		errors: error,
		aggregations: [],
	}));

	const network: Resolver<NetworkSearchRoot, NetworkQueryVariables, any, Context> = async (
		_unusedParentObj,
		args,
		context,
		info,
	) => {
		const connectedNodeInfo = [...remoteNodes.connected, ...localNodes].reduce<
			Record<string, NetworkNodeResponseData>
		>((acc, node) => {
			acc[node.displayName] = {
				name: node.displayName,
				hits: 0,
				status: CONNECTION_STATUS.OK,
				errors: '',
				aggregations: node.aggregations,
			};
			return acc;
		}, {});

		const requestedFieldsMap = resolveInfoToMap(info, 'aggregations');
		/*
		 * Checks validity of SQON
		 * For now we will pass through the non SQON object to the pipeline
		 *
		 * // TODO: resolve Arranger / SQONBuilder SQON outer wrapper conflict
		 * {"content": [{...}], "op": "and"}
		 */
		if ('filters' in args) {
			const result = convertToSqon(args.filters);
			if (result.success) {
				throw new Error(`Provided filter is not a valid sqon: ${result.data}`);
			}
		}
		const queryVariables = { ...args };

		/*
		 * Aggregation pipeline entrypoint
		 */
		const { aggregationResults, nodeInfo } = await aggregationPipeline<Context>({
			context,
			localNodes,
			queryVariables,
			remoteNodes: remoteNodes.connected,
			requestedAggregationFields: requestedFieldsMap,
			graphqlResolveInfo: info,
		});

		// Combine the nodeInfo results onto our connectedNodeInfo
		nodeInfo.forEach((nodeResult) => {
			const connectedNode = connectedNodeInfo[nodeResult.name];
			if (connectedNode) {
				connectedNode.hits = nodeResult.hits;
				connectedNode.status = nodeResult.status;
				connectedNode.errors = nodeResult.errors;
			}
		});

		return createResponse({
			aggregationResults,
			nodeInfo: [...Object.values(connectedNodeInfo), ...failedNodeInfo],
		});
	};

	return {
		Root: {
			network,
		},
	};
};
