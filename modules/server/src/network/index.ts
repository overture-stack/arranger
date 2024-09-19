import { makeExecutableSchema } from '@graphql-tools/schema';
import { SUPPORTED_AGGREGATIONS_LIST } from './common';
import { createResolvers } from './resolvers';
import { getAllFieldTypes } from './setup/fields';
import { fetchRemoteSchemas } from './setup/query';
import { NetworkConfig } from './setup/types';
import { createTypeDefs } from './typeDefs';

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
	const networkFields = await fetchRemoteSchemas({
		networkConfigs,
	});

	const networkFieldTypes = getAllFieldTypes(networkFields, SUPPORTED_AGGREGATIONS_LIST);

	const typeDefs = createTypeDefs(networkFieldTypes);

	const resolvers = createResolvers(networkConfigs);

	const networkSchema = makeExecutableSchema({ typeDefs, resolvers });

	return { networkSchema };
};
