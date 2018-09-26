import { makeExecutableSchema, addMockFunctionsToSchema } from 'graphql-tools';
import typeDefs from './typeDefs';
import resolvers from './resolvers';

export const createSchema = () => {
  const schema = makeExecutableSchema({ typeDefs });
  //   const schema = makeExecutableSchema({ typeDefs, resolvers });
  addMockFunctionsToSchema({ schema });
  return schema;
};
