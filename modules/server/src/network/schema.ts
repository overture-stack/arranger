import { mergeTypeDefs } from '@graphql-tools/merge';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { GraphQLSchema } from 'graphql';
import { NetworkAggregationConfig } from './types';

const generateExclusions = () => {
	return [];
};

export const createNetworkAggregationSchema = (newtworkConfigs: NetworkAggregationConfig[]) => {
	// filter remote connections with valid schemas
	const typesArr = newtworkConfigs
		.filter((c) => c.schema !== null)
		.map((c) => c.schema as GraphQLSchema);
	//https://the-guild.dev/graphql/tools/docs/api/modules/merge_src#mergetypedefs
	// export type TypeSource =
	// | string
	// | Source // gql-ref
	// | DocumentNode // gql-ref
	// | GraphQLSchema // gql-ref
	// | DefinitionNode // gql-ref
	// | Array<TypeSource>
	// | (() => TypeSource);

	const options = {
		forceSchemaDefinition: true,
		//onFieldTypeConflict: (x) => console.log(x),
		//useSchemaDefinition: false,
		exclusions: generateExclusions(), // string[]
	};
	const typeDefs = mergeTypeDefs(typesArr, options);

	const networkSchema = makeExecutableSchema({ typeDefs });

	return networkSchema;
};
