import { ApolloServer, gql } from 'apollo-server-express';
import { makeExecutableSchema, mergeSchemas } from 'graphql-tools';
import { createSchema as createAggsStateSchema } from './AggsState';

// Construct a schema, using GraphQL schema language
const typeDefs = gql`
  type Query {
    hello: String
  }
`;

// Provide resolver functions for your schema fields
const resolvers = {
  Query: {
    hello: () => 'Hello world!',
  },
};
const rootSchema = makeExecutableSchema({ typeDefs, resolvers });

const mergedSchema = mergeSchemas({
  schemas: [rootSchema, createAggsStateSchema()],
});

export default () => new ApolloServer({ schema: mergedSchema });
