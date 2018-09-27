import { makeExecutableSchema, addMockFunctionsToSchema } from 'graphql-tools';
import typeDefs from './typeDefs';
import resolvers from './resolvers';

export const createSchema = async () => {
  const schema = makeExecutableSchema({
    typeDefs: await typeDefs(),
    resolvers,
  });
  //   const schema = makeExecutableSchema({ typeDefs });
  addMockFunctionsToSchema({ schema });
  return schema;
};
