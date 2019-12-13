import {
  addMockFunctionsToSchema,
  IResolversParameter,
  mergeSchemas,
} from 'graphql-tools';
import { ApolloServer } from 'apollo-server-express';
import { Client } from '@elastic/elasticsearch';
import { print } from 'graphql/language/printer';
import { createClient as createElasticsearchClient } from './services/elasticsearch';

import { createSchema as createProjectSchema } from './schemas/ProjectSchema';
import { createSchema as createIndexSchema } from './schemas/IndexSchema';
import { createSchema as createAggsStateSchema } from './schemas/AggsState';
import { createSchema as createMatchboxStateSchema } from './schemas/MatchboxState';
import { createSchema as createColumnsStateSchema } from './schemas/ColumnsState';
import { createSchema as createExtendedMappingSchema } from './schemas/ExtendedMapping';
import mergedTypeDefs from './schemaTypeDefs';
import { AdminApiConfig, IQueryContext } from './types';
import {
  createAggsStateByIndexResolver,
  createColumnsStateByIndexResolver,
  createExtendedMappingsByIndexResolver,
  createIndexByProjectResolver,
  createIndicesByProjectResolver,
  createMatchBoxStateByIndexResolver,
} from './resolvers';
import { constants } from './services/constants';

const createSchema = async () => {
  const typeDefs = mergedTypeDefs;

  const projectSchema = await createProjectSchema();
  const aggsStateSchema = await createAggsStateSchema();
  const collumnsStateSchema = await createColumnsStateSchema();
  const extendedMappingShema = await createExtendedMappingSchema();
  const matchBoxStateSchema = await createMatchboxStateSchema();
  const indexSchema = await createIndexSchema();

  const mergedSchema = mergeSchemas({
    schemas: [
      projectSchema,
      indexSchema,
      aggsStateSchema,
      collumnsStateSchema,
      extendedMappingShema,
      matchBoxStateSchema,
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
        aggsState: createAggsStateByIndexResolver(aggsStateSchema),
        matchBoxState: createMatchBoxStateByIndexResolver(matchBoxStateSchema),
      },
    } as IResolversParameter,
  });
  addMockFunctionsToSchema({ schema: mergedSchema, preserveResolvers: true });
  return mergedSchema;
};

const initialize = (config: AdminApiConfig): Promise<Client> =>
  new Promise(async (resolve, reject) => {
    const esClient = createElasticsearchClient(config.esHost);
    try {
      const exists = await esClient.indices.exists({
        index: constants.ARRANGER_PROJECT_INDEX,
      });
      if (!exists) {
        esClient.indices.create({
          index: constants.ARRANGER_PROJECT_INDEX,
        });
      }
      resolve(esClient);
    } catch (err) {
      setTimeout(() => {
        initialize(config).then(() => resolve(esClient));
      }, 1000);
    }
  });

export default async (config: AdminApiConfig) => {
  const esClient = await initialize(config);
  return new ApolloServer({
    schema: await createSchema(),
    context: (): IQueryContext => ({
      es: esClient,
    }),
  });
};
