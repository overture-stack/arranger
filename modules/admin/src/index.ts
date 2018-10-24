import { ApolloServer } from 'apollo-server-express';
import { addMockFunctionsToSchema, mergeSchemas } from 'graphql-tools';
import { Client } from 'elasticsearch';

import { createClient as createElasticsearchClient } from './services/elasticsearch';
import { createSchema as createProjectSchema } from './schemas/ProjectSchema';
import { createSchema as createIndexSchema } from './schemas/IndexSchema';
import { createSchema as createAggsStateSchema } from './schemas/AggsState';
import { createSchema as createColumnsStateSchema } from './schemas/ColumnsState';
import { createSchema as createExtendedMappingSchema } from './schemas/ExtendedMapping';

const createSchema = async () => {
  const typeDefs = `
    extend type Index {
      aggsState: AggsState
      columnsState: ColumnsState
      extended(field: String): [ExtendedFieldMapping]
    }

    extend type Project {
      index(grapqlField: String!): Index
      indices: [Index]
    }
  `;

  const projectSchema = await createProjectSchema();
  const aggsStateSchema = await createAggsStateSchema();
  const collumnsStateSchema = await createColumnsStateSchema();
  const extendedMappingShema = await createExtendedMappingSchema();
  const indexSchema = await createIndexSchema();

  const mergedSchema = mergeSchemas({
    schemas: [
      projectSchema,
      indexSchema,
      aggsStateSchema,
      collumnsStateSchema,
      extendedMappingShema,
      typeDefs,
    ],
  });
  addMockFunctionsToSchema({ schema: mergedSchema, preserveResolvers: true });
  return mergedSchema;
};

export interface AdminApiConfig {
  esHost: string;
}
export interface QueryContext {
  es: Client;
}
export default async (config: AdminApiConfig) => {
  const esClient = createElasticsearchClient(config.esHost);
  return new ApolloServer({
    schema: await createSchema(),
    context: (): QueryContext => ({
      es: esClient,
    }),
  });
};
