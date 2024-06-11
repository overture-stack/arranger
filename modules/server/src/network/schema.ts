import { Config, mergeTypeDefs } from '@graphql-tools/merge';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { TypeSource } from '@graphql-tools/utils';
import { GraphQLObjectType, GraphQLSchema } from 'graphql';
import { NetworkAggregationConfig } from './types';

/**
 * string array of field names to exclude
 * @returns string[]
 */
const generateExclusions = (config: any): string[] => {
	return [];
};

// return schema graphobject schema
export const createNetworkAggregationSchema = (newtworkConfigs: NetworkAggregationConfig[]) => {
	// filter remote connections with valid schemas
	const typesArr: TypeSource = newtworkConfigs
		.filter((c) => c.schema !== null)
		.map((c) => c.schema as GraphQLSchema);

	const exclusions = generateExclusions(config);

	// https://the-guild.dev/graphql/tools/docs/api/modules/merge_src#mergetypedefs
	const options: Omit<Partial<Config>, 'commentDescriptions'> = {
		forceSchemaDefinition: true,
		//onFieldTypeConflict: (x) => console.log(x),
		exclusions,
	};

	const typeDefs = mergeTypeDefs(typesArr, options);
	console.log(typeDefs);
	// const x = new GraphQLObjectType({name: 'network', fields: })

	const networkSchema = makeExecutableSchema({ typeDefs });

	return networkSchema;
};
