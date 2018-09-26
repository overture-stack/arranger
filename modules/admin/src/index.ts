import { ApolloServer } from 'apollo-server-express';
import { mergeSchemas, addMockFunctionsToSchema } from 'graphql-tools';
import { createSchema as createAggsStateSchema } from './AggsState';
import { createSchema as createColumnsStateSchema } from './ColumnsState';
import { createSchema as createIndexSchema } from './IndexSchema';

const createSchema = async () => {
  const typeDefs = `
    extend type Index {
      aggsState: AggsState
      columnsState: ColumnsState
    }

    type Project {
      id: String!
      index(grapqlField: String!): Index
      indices: [Index]
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
  const indexSchema = await createIndexSchema();

  const mergedSchema = mergeSchemas({
    schemas: [aggsStateSchema, collumnsStateSchema, indexSchema, typeDefs],
  });
  addMockFunctionsToSchema({ schema: mergedSchema });
  return mergedSchema;
};

export default async () => new ApolloServer({ schema: await createSchema() });
