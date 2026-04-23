import { makeExecutableSchema } from 'graphql-tools';

import resolvers from './resolvers.js';
import typeDefs from './schemaTypeDefs.js';

export const createSchema = async () => {
	const schema = makeExecutableSchema({
		typeDefs: await typeDefs(),
		resolvers,
	});
	return schema;
};
