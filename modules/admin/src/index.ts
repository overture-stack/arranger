import {
  addMockFunctionsToSchema,
  IResolversParameter,
  mergeSchemas,
} from 'graphql-tools';
import { ApolloServer } from 'apollo-server-express';
import { print } from 'graphql/language/printer';
import { createClient as createElasticsearchClient } from './services/elasticsearch';

import { createSchema as createProjectSchema } from './schemas/ProjectSchema';
import { createSchema as createIndexSchema } from './schemas/IndexSchema';
import { createSchema as createAggsStateSchema } from './schemas/AggsState';
import { createSchema as createColumnsStateSchema } from './schemas/ColumnsState';
import { createSchema as createExtendedMappingSchema } from './schemas/ExtendedMapping';
import mergedTypeDefs from './schemaTypeDefs';
import { AdminApiConfig, IQueryContext } from './types';
import {
  createColumnsStateByIndexResolver,
  createExtendedMappingsByIndexResolver,
  createIndexByProjectResolver,
  createIndicesByProjectResolver,
} from './resolvers';

const createSchema = async () => {
  const typeDefs = mergedTypeDefs;

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
      print(typeDefs),
    ],
    resolvers: {
      Project: {
        index: createIndexByProjectResolver(indexSchema),
        indices: createIndicesByProjectResolver(indexSchema),
      },
      Index: {
        extended: createExtendedMappingsByIndexResolver(extendedMappingShema),
        columnsState: createColumnsStateByIndexResolver(collumnsStateSchema),
      },
    } as IResolversParameter,
  });
  addMockFunctionsToSchema({ schema: mergedSchema, preserveResolvers: true });
  return mergedSchema;
};

export default async (config: AdminApiConfig) => {
  const esClient = createElasticsearchClient(config.esHost);
  return new ApolloServer({
    schema: await createSchema(),
    context: (): IQueryContext => ({
      es: esClient,
    }),
  });
};
