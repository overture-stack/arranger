import resolvers from './resolvers';
import typeDefs from './schemaTypeDefs';
import { addMockFunctionsToSchema, makeExecutableSchema } from 'graphql-tools';

export const createSchema = async () => {
  const schema = makeExecutableSchema({
    typeDefs: await typeDefs(),
    resolvers,
  });
  // addMockFunctionsToSchema({ schema });
  return schema;
};
