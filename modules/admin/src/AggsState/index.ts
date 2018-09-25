import { makeExecutableSchema } from 'graphql-tools';
import typeDefs from './typeDefs';
import resolvers from './resolvers';

export const createSchema = () => makeExecutableSchema({ typeDefs, resolvers });
