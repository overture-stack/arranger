import resolvers from './resolvers';
import typeDefs from './typeDefs';
import { makeExecutableSchema } from 'graphql-tools';

export const createSchema = async () => {
  const schema = makeExecutableSchema({
    typeDefs: await typeDefs(),
    resolvers,
  });
  return schema;
};
