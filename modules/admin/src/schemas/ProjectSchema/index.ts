import { makeExecutableSchema, addMockFunctionsToSchema } from 'graphql-tools';
import typeDefs from './typeDefs';
import { createResolvers } from './resolvers';

export const createSchema = async () => {
  const schema = makeExecutableSchema({
    typeDefs: await typeDefs(),
    resolvers: await createResolvers(),
  });
  addMockFunctionsToSchema({ schema, preserveResolvers: true });
  return schema;
};
