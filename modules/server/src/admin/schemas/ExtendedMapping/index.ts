import { makeExecutableSchema } from 'graphql-tools';
import typeDefs from './schemaTypeDefs';
import resolvers from './resolvers';

export const createSchema = async () => {
  const schema = makeExecutableSchema({
    typeDefs: await typeDefs(),
    resolvers,
  });
  return schema;
};
