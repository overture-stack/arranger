import { addMockFunctionsToSchema, makeExecutableSchema } from 'graphql-tools';
import typeDefs from './typeDefs';
import resolvers from './resolvers';

export const createSchema = async () => {
  const schema = makeExecutableSchema({
    typeDefs: await typeDefs(),
    resolvers,
  });
  addMockFunctionsToSchema({ schema });
  return schema;
};
