import { makeExecutableSchema } from '@graphql-tools/schema';
import { createResolvers } from './resolvers';
import { SUPPORTED_AGGREGATIONS } from './setup/constants';
import { getAllFieldTypes } from './setup/fields';
import { fetchAllNodeAggregations } from './setup/query';
import { createTypeDefs } from './typeDefs';
import { NetworkConfig } from './types/setup';

export let ALL_NETWORK_AGGREGATION_TYPES_MAP: Map<string, keyof typeof SUPPORTED_AGGREGATIONS> =
	new Map();

/**
 * GQL Federated Search schema setup
 * Connects to remote network connections, looks up field types, add field/type pairs to configs
 *
 * @param { networkConfigs }
 * @returns graphql schema for the network - types and resolvers combined
 */
export const createSchemaFromNetworkConfig = async ({
	networkConfigs,
}: {
	networkConfigs: NetworkConfig[];
}) => {
	const nodeConfig = await fetchAllNodeAggregations({
		networkConfigs,
	});

	const networkFieldTypes = getAllFieldTypes(nodeConfig);

	/*
	 * make schema type available for resolvers at query time
	 * { name: "donor_age", type: "NumericAggregations" }
	 * donor_age => NumericAggregations
	 * runs on schema setup once at bootstrap
	 */
	networkFieldTypes.forEach((field) =>
		ALL_NETWORK_AGGREGATION_TYPES_MAP.set(field.name, field.type),
	);

	const typeDefs = createTypeDefs(networkFieldTypes);

	const resolvers = createResolvers(nodeConfig);

	const networkSchema = makeExecutableSchema({ typeDefs, resolvers });

	return { networkSchema };
};
