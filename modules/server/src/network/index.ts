import { makeExecutableSchema } from '@graphql-tools/schema';
import { SUPPORTED_AGGREGATIONS_LIST } from './common';
import { createResolvers } from './resolvers';
import { getAllFieldTypes } from './setup/fields';
import { fetchAllNodeAggregations } from './setup/query';
import { createTypeDefs } from './typeDefs';
import { NetworkConfig } from './types/setup';

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

	const networkFieldTypes = getAllFieldTypes(nodeConfig, SUPPORTED_AGGREGATIONS_LIST);

	const typeDefs = createTypeDefs(networkFieldTypes);

	const resolvers = createResolvers(nodeConfig);

	const networkSchema = makeExecutableSchema({ typeDefs, resolvers });

	return { networkSchema };
};
