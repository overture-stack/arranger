import { ApolloServer } from 'apollo-server-express';
import express from 'express';
import makeSchema from '@arranger/schema';
import { extendFields, addMappingsToTypes } from '@arranger/mapping-utils';
import { fetchMappings } from './utils/fetchMappings';
import mapHits from './utils/mapHits';
import { setProject } from './utils/projects';
import download from './download';
import getIndexPrefix from './utils/getIndexPrefix';
import { setsMapping } from '@arranger/schema';
import { CONSTANTS } from '@arranger/middleware';
import getTypes from './utils/getTypes';
import expressPlayground from 'graphql-playground-middleware-express';

const initializeSets = async ({ es }) => {
  if (!(await es.indices.exists({ index: CONSTANTS.ES_ARRANGER_SET_INDEX }))) {
    await es.indices.create({
      index: CONSTANTS.ES_ARRANGER_SET_INDEX,
      body: {
        mappings: {
          [CONSTANTS.ES_ARRANGER_SET_TYPE]: {
            properties: setsMapping,
          },
        },
      },
    });
  }
};

const getTypesWithMappings = async ({ es, id }) => {
  if (!id) throw new Error('project empty');

  // indices must be lower cased
  id = id.toLowerCase();

  const types = await getTypes({ id, es });

  if (!types) return;
  const hits = mapHits(types);
  const mappings = await fetchMappings({ es, types: hits });
  if (!mappings.length) return; // gate to not start a project that doesn't exist

  const extended = await Promise.all(
    hits.map(async (type) => {
      const indexPrefix = getIndexPrefix({ projectId: id, index: type.index });
      try {
        const size = (
          await es.search({
            index: indexPrefix,
            size: 0,
            _source: false,
          })
        ).hits.total;

        const fields = extendFields(
          mapHits(
            (
              await es.search({
                index: indexPrefix,
                size: size,
              })
            ).body,
          ),
        );

        return { ...type, indexPrefix, fields };
      } catch (err) {
        const fields = type.config.extended;
        return { ...type, indexPrefix, fields };
      }
    }),
  );
  const typesWithMappings = addMappingsToTypes({
    types: extended.map((type) => {
      return [
        type.name,
        {
          index: type.index,
          name: type.name,
          extendedFields: type.fields,
          customFields: ``,
          indexPrefix: type.indexPrefix,
          config: type.config || {},
        },
      ];
    }),
    mappings: mappings.map((m) => m.mapping),
  });

  return typesWithMappings;
};

export const getDefaultServerSideFilter = () => ({
  op: 'not',
  content: [],
});

export const createProjectSchema = async ({
  es,
  id,
  graphqlOptions = {},
  enableAdmin,
  typesWithMappings,
  getServerSideFilter = getDefaultServerSideFilter,
}) => {
  if (!typesWithMappings) {
    typesWithMappings = await getTypesWithMappings({ es, id });
  }
  await initializeSets({ es });

  // console.log('typesWithMappings: ', typesWithMappings);
  if (!id) throw new Error('project empty');

  // indices must be lower cased
  id = id.toLowerCase();

  const types = await getTypes({ id, es });

  if (!types) return;

  const schema = makeSchema({
    types: typesWithMappings,
    rootTypes: [],
    middleware: graphqlOptions.middleware || [],
    enableAdmin,
    getServerSideFilter,
  });

  const mockSchema = makeSchema({
    types: typesWithMappings,
    rootTypes: [],
    mock: true,
    getServerSideFilter,
  });

  await initializeSets({ es });

  return { schema, mockSchema };
};

export const createProjectEndpoint = async ({
  es,
  id,
  graphqlOptions = {},
  enableAdmin,
  typesWithMappings,
  getServerSideFilter = getDefaultServerSideFilter,
}) => {
  const { schema, mockSchema } = await createProjectSchema({
    es,
    id,
    graphqlOptions,
    enableAdmin,
    typesWithMappings,
    getServerSideFilter,
  });

  const projectApp = express.Router();

  projectApp.use(`/`, (req, res, next) => {
    req.context = req.context || {};
    req.context.es = es;
    next();
  });

  projectApp.get(`/ping`, (req, res) => res.send({ status: 'ok' }));

  const externalContext =
    typeof graphqlOptions.context === 'function'
      ? await graphqlOptions.context(request, response, graphQLParams)
      : graphqlOptions.context;
  const apolloServer = new ApolloServer({
    schema,
    context: {
      es,
      projectId: id,
      ...(externalContext || {}),
    },
  });

  const noSchemaHandler = (req, res) =>
    res.json({
      error:
        'schema is undefined. Make sure you provide a valid GraphQL Schema. https://www.apollographql.com/docs/graphql-tools/generate-schema.html',
    });

  new ApolloServer({
    schema: mockSchema,
  }).applyMiddleware({
    app: projectApp,
    path: `/mock/graphql`,
  });

  projectApp.get(
    '/graphql',
    expressPlayground({
      endpoint: `graphql`, // this resolves to `${id}/graphql`
    }),
  );
  apolloServer.applyMiddleware({
    app: projectApp,
    path: `/graphql`,
  });

  projectApp.use(`/download`, download({ projectId: id }));

  setProject({ app: projectApp, schema, mockSchema, es, id });
  console.log(`graphql server running at /${id}/graphql`);

  return projectApp;
};

export default async function startProjectApp({
  es,
  id,
  graphqlOptions = {},
  enableAdmin,
  getServerSideFilter = getDefaultServerSideFilter,
}) {
  const typesWithMappings = await getTypesWithMappings({
    es,
    id,
  });

  await initializeSets({ es });

  return await createProjectEndpoint({
    es,
    id,
    graphqlOptions,
    enableAdmin,
    typesWithMappings,
    getServerSideFilter,
  });
}
