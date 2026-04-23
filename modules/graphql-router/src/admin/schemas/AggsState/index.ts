import resolvers from './resolvers.js';
import typeDefs from './schemaTypeDefs.js';
import { makeExecutableSchema } from 'graphql-tools';

export const createSchema = async () => {
	const schema = makeExecutableSchema({
		typeDefs: await typeDefs(),
		resolvers,
	});
	return schema;
};
