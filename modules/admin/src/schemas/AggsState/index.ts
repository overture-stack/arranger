import resolvers from './resolvers';
import typeDefs from './typeDefs';
import { addMockFunctionsToSchema, makeExecutableSchema } from 'graphql-tools';

export const createSchema = async () => {
  const schema = makeExecutableSchema({
    typeDefs: await typeDefs(),
    resolvers,
  });
  //   const schema = makeExecutableSchema({ typeDefs });
  addMockFunctionsToSchema({ schema });
  return schema;
};
