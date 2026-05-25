import { addMocksToSchema } from '@graphql-tools/mock';
import { makeExecutableSchema } from 'graphql-tools';

import { createResolvers } from './resolvers';
import typeDefs from './schemaTypeDefs';

export const createSchema = async () => {
  const schema = makeExecutableSchema({
    typeDefs: await typeDefs(),
    resolvers: await createResolvers(),
  });
  addMocksToSchema({ schema, preserveResolvers: true });
  return schema;
};
