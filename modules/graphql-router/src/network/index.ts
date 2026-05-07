import { makeExecutableSchema } from '@graphql-tools/schema';

import { createResolvers } from './resolvers/index.js';
import type { SUPPORTED_AGGREGATIONS } from './setup/constants.js';
import { combineAllFieldTypes } from './setup/fields.js';
import {
	fetchAllNodeAggregations,
	type FetchAggregationInvalidData,
	type FetchAggregationNetworkError,
	type FetchAggregationSuccess,
} from './setup/query.js';
import { createTypeDefs } from './typeDefs/index.js';
import { type NetworkRemoteNode } from './types/setup.js';
import partitionArray from '../utils/partitionArray.js';
import {
	isRemoteNode,
	type LocalNodeConfig,
	type NodeConfig,
	type RemoteNodeConfig,
} from '@overture-stack/arranger-types/configs';
import type { GraphQLSchema } from 'graphql';
import { result, success, type AsyncResult } from './result.js';

/**
 * Map of all available fields with associated aggregation type
 */
export const ALL_NETWORK_AGGREGATION_TYPES_MAP = new Map<string, keyof typeof SUPPORTED_AGGREGATIONS>();

/**
 * GQL Federated Search schema setup
 * 1) Connects to remote Arranger instances as defined in Arranger config
 * 2) Looks up available field types
 * 3) Adds field/type pairs to config map
 *
 * ! Important ! - This functionality assumes Arranger instances are running identical versions
 *
 * @param { networkConfigs }
 * @returns Graphql schema for the network - types and resolvers combined
 */
export const createSchemaFromNetworkConfig = async ({
	networkConfigs,
}: {
	networkConfigs: NodeConfig[];
}): AsyncResult<GraphQLSchema, { NO_AVAILAVBLE_NODES: void }> => {
	const [remoteNodes, localNodes] = partitionArray<RemoteNodeConfig, LocalNodeConfig>(networkConfigs, isRemoteNode);

	// Fetches meta data from remote Arranger instances and adds aggregation field/type information to networked node configuration
	const nodesFetchResults = await fetchAllNodeAggregations({
		networkConfigs: remoteNodes,
	});

	// TODO: Nodes that fail to fetch on startup are removed from gql schema and are never queried or reported on in
	const [successfulRemoteNodeResults, failedRemoteNodeResults] = partitionArray<
		FetchAggregationSuccess,
		FetchAggregationNetworkError | FetchAggregationInvalidData
	>(nodesFetchResults, (result) => result.result === 'SUCCESS');

	const successfulNodes = successfulRemoteNodeResults.map((result) => result.node);
	const failedNodes = failedRemoteNodeResults.map((result) => ({
		config: result.config,
		error: `${result.result} - ${result.message}`,
	}));

	if (successfulNodes.length === 0) {
		console.error(
			'Failed to connect to any nodes. The network search cannot be initialized. Continuing startup without network configuration.',
		);
		return result('NO_AVAILAVBLE_NODES', undefined);
	}

	// An array of unique supported aggregation types
	const allAvailableAggregationTypes = combineAllFieldTypes(successfulNodes);
	if (allAvailableAggregationTypes.length === 0) {
		console.error(
			'There are no aggregation types available on any of the network nodes. The network search cannot be initialized. Continuing startup without network configuration.',
		);
		return result('NO_AVAILAVBLE_NODES', undefined);
	}

	/*
	 * Runs on schema setup, once at bootstrap.
	 * Make schema type available for resolvers at query time
	 * { name: "donor_age", type: "NumericAggregations" }
	 */
	allAvailableAggregationTypes.forEach((field) => ALL_NETWORK_AGGREGATION_TYPES_MAP.set(field.name, field.type));
	/*
	 * GQL typedef, resolver and schema creation
	 */
	const typeDefs = createTypeDefs(allAvailableAggregationTypes);
	const resolvers = createResolvers(successfulNodes, failedNodes);
	const networkSchema = makeExecutableSchema({ typeDefs, resolvers });

	return success(networkSchema);
};
