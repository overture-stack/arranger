import { makeExecutableSchema } from '@graphql-tools/schema';
import {
	type CustomizeRemoteRequestFn,
	type LocalNodeConfig,
	type RemoteNodeConfig,
} from '@overture-stack/arranger-types/configs';
import type { GraphQLSchema } from 'graphql';

import type { ArrangerBaseContext } from '#types.js';
import partitionArray from '#utils/partitionArray.js';

import { createResolvers } from './resolvers/index.js';
import { result, success, type AsyncResult } from './result.js';
import type { SUPPORTED_AGGREGATIONS } from './setup/constants.js';
import { combineAllFieldTypes, isFieldAggregationSupported } from './setup/fields.js';
import {
	fetchAllNodeAggregations,
	type FetchAggregationInvalidData,
	type FetchAggregationNetworkError,
	type FetchAggregationSuccess,
} from './setup/query.js';
import { createTypeDefs } from './typeDefs/index.js';
import type { NetworkLocalNode } from './types/setup.js';
import type { LocalCatalogSchemaData } from './types.js';

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
export const createSchemaFromNetworkConfig = async <Context extends ArrangerBaseContext>({
	customizeRemoteRequest,
	enableDebug,
	remoteNodeConfigs,
	localNodeConfigs,
	localCatalogs,
}: {
	customizeRemoteRequest?: CustomizeRemoteRequestFn<Context>;
	enableDebug: boolean;
	remoteNodeConfigs: RemoteNodeConfig[];
	localNodeConfigs: LocalNodeConfig[];
	localCatalogs: LocalCatalogSchemaData<Context>[];
}): AsyncResult<GraphQLSchema, { NO_AGGREGATIONS: null }> => {
	/* ================== *
	 * Setup Remote Nodes
	 * ================== */
	// Fetches meta data from remote Arranger instances and adds aggregation field/type information to networked node configuration
	const nodesFetchResults = await fetchAllNodeAggregations({
		networkConfigs: remoteNodeConfigs,
	});

	// TODO: Nodes that fail to fetch on startup are removed from gql schema and are never queried or reported on in
	const [successfulRemoteNodeResults, failedRemoteNodeResults] = partitionArray<
		FetchAggregationSuccess,
		FetchAggregationNetworkError | FetchAggregationInvalidData
	>(nodesFetchResults, (result) => result.result === 'SUCCESS');

	const connectedRemoteNodes = successfulRemoteNodeResults.map((result) => result.node);
	const failedRemoteNodes = failedRemoteNodeResults.map((result) => ({
		config: result.config,
		error: `${result.result} - ${result.message}`,
	}));

	/* ================== *
	 * Setup Local Nodes
	 * ================== */

	const availableLocalNodes: NetworkLocalNode<Context>[] = [];
	const missingLocalNodes: { config: LocalNodeConfig; error: string }[] = [];

	localNodeConfigs.forEach((localConfig) => {
		/* ================================================ *
		 *  Find catalog that corresponds with this config
		 * ================================================ */

		const catalog = localCatalogs.find((catalog) => localConfig.catalogId === catalog.catalogId);
		if (!catalog) {
			console.error(
				`A local network node configuration specified a catalog ID '${localConfig.catalogId}' that cannot be found on this server. This node will not be included in the network search.`,
			);

			missingLocalNodes.push({
				config: localConfig,
				error: 'Required local search catalog is not available.',
			});
			return;
		}

		/* ======================================= *
		 *  Get Resolvers (hits and aggregations)
		 * ======================================= */
		const aggregationResolver = catalog.resolvers['aggregations'];
		const hitsResolver = catalog.resolvers['hits'];

		availableLocalNodes.push({
			catalogId: localConfig.catalogId,
			displayName: localConfig.displayName,
			nodeId: localConfig.nodeId,
			resolvers: { aggregations: aggregationResolver, hits: hitsResolver },
			aggregations: catalog.configs.aggregations,
		});
	});

	/* ========================== *
	 * Create GQL Schema TypeDefs
	 * ========================== */
	// An array of unique supported aggregation types
	const allAvailableAggregationTypes = [
		...combineAllFieldTypes(connectedRemoteNodes),
		...availableLocalNodes.flatMap((node) => node.aggregations).filter(isFieldAggregationSupported),
	];
	if (allAvailableAggregationTypes.length === 0) {
		console.error(
			'There are no aggregation types available on any of the network nodes. The network search cannot be initialized. Continuing startup without network configuration.',
		);
		return result('NO_AGGREGATIONS', null);
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
	const resolvers = createResolvers({
		remoteNodes: {
			connected: connectedRemoteNodes,
			failed: failedRemoteNodes,
			customizeRemoteRequest,
		},
		localNodes: { available: availableLocalNodes, missing: missingLocalNodes },
	});
	const networkSchema = makeExecutableSchema({ typeDefs, resolvers });

	return success(networkSchema);
};
