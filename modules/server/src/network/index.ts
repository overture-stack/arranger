import { makeExecutableSchema } from '@graphql-tools/schema';
import { createResolvers } from './resolvers';
import { SUPPORTED_AGGREGATIONS } from './setup/constants';
import { normalizeFieldTypes } from './setup/fields';
import { fetchAllNodeAggregations } from './setup/query';
import { createTypeDefs } from './typeDefs';
import { NetworkConfig } from './types/setup';

/**
 * Map of all available fields with associated aggregation type
 */
export let ALL_NETWORK_AGGREGATION_TYPES_MAP: Map<string, keyof typeof SUPPORTED_AGGREGATIONS> =
	new Map();

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
	networkConfigs: NetworkConfig[];
}) => {
	/**
	 * Fetches meta data from remote Arranger instances
	 * Adds aggregation fied/type information to networked node configuration
	 */
	const nodeConfig = await fetchAllNodeAggregations({
		networkConfigs,
	});

	/**
	 * An array of unique supported aggregation types
	 */
	const aggregationTypes = normalizeFieldTypes(nodeConfig);

	/*
	 * Runs on schema setup, once at bootstrap.
	 * Make schema type available for resolvers at query time
	 * { name: "donor_age", type: "NumericAggregations" }
	 */
	aggregationTypes.forEach((field) =>
		ALL_NETWORK_AGGREGATION_TYPES_MAP.set(field.name, field.type),
	);

	/*
	 * GQL typedef, resolver and schema creation
	 */
	const typeDefs = createTypeDefs(aggregationTypes);
	const resolvers = createResolvers(nodeConfig);
	const networkSchema = makeExecutableSchema({ typeDefs, resolvers });

	return networkSchema;
};
