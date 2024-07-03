import { Config, mergeTypeDefs } from '@graphql-tools/merge';
import { DocumentNode, GraphQLSchema } from 'graphql';

/**
 *
 * @remarks
 * mergeTypeDefs function can handle a lot of options including
 * exclusions and customising how to handle conflicts.
 * See full documentation here: https://the-guild.dev/graphql/tools/docs/api/modules/merge_src#mergetypedefs
 *
 * @param networkConfigs
 * @returns
 */
export const createNetworkAggregationTypeDefs = (gqlTypes: GraphQLSchema[]): DocumentNode => {
	const options: Omit<Partial<Config>, 'commentDescriptions'> = {
		forceSchemaDefinition: true,
	};
	const typeDefs = mergeTypeDefs(gqlTypes, options);

	return typeDefs;
};
