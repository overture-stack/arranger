import typeDefs from './schemaTypeDefs';
import { addMockFunctionsToSchema, makeExecutableSchema } from 'graphql-tools';
import { createResolvers } from './resolvers';

export const createSchema = async () => {
  const schema = makeExecutableSchema({
    typeDefs: await typeDefs(),
    resolvers: await createResolvers(),
  });
  addMockFunctionsToSchema({ schema, preserveResolvers: true });
  return schema;
};
