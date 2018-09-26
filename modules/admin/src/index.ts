import { ApolloServer, gql } from 'apollo-server-express';
import { mergeSchemas, addMockFunctionsToSchema } from 'graphql-tools';
import { createSchema as createAggsStateSchema } from './AggsState';
import { createSchema as createColumnsStateSchema } from './ColumnsState';

const createSchema = async () => {
  const typeDefs = `
    type Project {
      id: String!
      aggsState(graphqlField: String!): AggsState
      columnsState(graphqlField: String!): ColumnsState
    }

    type Query {
      projects: [Project]
      project(id: String!): Project
    }

    type Mutation {
      newProject(name: String!): Project
      deleteProject(name: String!): Project
    }
  `;

  const aggsStateSchema = await createAggsStateSchema();
  const collumnsStateSchema = await createColumnsStateSchema();

  const mergedSchema = mergeSchemas({
    schemas: [aggsStateSchema, collumnsStateSchema, typeDefs],
  });
  addMockFunctionsToSchema({ schema: mergedSchema });
  return mergedSchema;
};

export default async () => new ApolloServer({ schema: await createSchema() });
