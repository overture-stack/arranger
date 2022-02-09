// TODO: for TS, we'll have to update "apollo-server-express" (which relies on graphql updates too)
import { ApolloServer } from 'apollo-server-express';
import express from 'express';
import expressPlayground from 'graphql-playground-middleware-express';

import getConfigObject, { initializeSets } from './config';
import { addMappingsToTypes, extendFields, fetchMapping } from './mapping';
import makeSchema from './schema';

const getTypesWithMappings = async (esClient, configs = {}) => {
  if (Object.keys(configs).length > 0) {
    try {
      console.log(' \nNow creating a GraphQL mapping based on the ES index:');
      const { mapping } = await fetchMapping({ esClient, index: configs?.index });

      if (mapping) {
        const extendedFields = await (async () => {
          try {
            return extendFields(mapping, configs?.extended);
          } catch (err) {
            return configs?.extended || [];
          }
        })();

        const typesWithMapping = addMappingsToTypes({
          graphQLType: {
            index: configs?.index,
            name: configs?.name,
            extendedFields,
            customFields: '',
            config: configs,
          },
          mapping,
        });

        console.log('  Success!\n');
        return typesWithMapping;
      }
    } catch (error) {
      console.error(error?.message || error);
      throw '  Something went wrong while creating the GraphQL mapping';
    }
  }

  throw Error('  No configs available at getTypesWithMappings');
};

const createSchema = async ({ enableAdmin, getServerSideFilter, graphqlOptions = {}, types }) => {
  const schemaBase = {
    getServerSideFilter,
    rootTypes: [],
    types,
  };

  return {
    ...(types && {
      mockSchema: makeSchema({
        mock: true,
        ...schemaBase,
      }),
      schema: makeSchema({
        enableAdmin,
        middleware: graphqlOptions.middleware || [],
        ...schemaBase,
      }),
    }),
  };
};

const createEndpoint = async ({
  esClient,
  graphqlOptions = {},
  enableAdmin,
  typesWithMappings,
  getServerSideFilter,
}) => {
  const router = express.Router();

  const { schema, mockSchema } = await createSchema({
    enableAdmin,
    getServerSideFilter,
    graphqlOptions,
    types: typesWithMappings,
  });

  const noSchemaHandler = (req, res) =>
    res.json({
      error:
        'schema is undefined. Make sure you provide a valid GraphQL Schema. https://www.apollographql.com/docs/graphql-tools/generate-schema.html',
    });

  console.log('------------------------------------');

  if (schema) {
    const buildContext = async (req, res, connection) => {
      const externalContext =
        typeof graphqlOptions.context === 'function'
          ? await graphqlOptions.context(req, res, connection)
          : graphqlOptions.context;

      return {
        esClient,
        ...(externalContext || {}),
      };
    };

    new ApolloServer({
      schema,
      context: ({ req, res, con }) => buildContext(req, res, con),
    }).applyMiddleware({
      app: router,
      path: '/graphql',
    });

    console.log('- GraphQL server running at .../graphql');
  } else {
    router.use('/graphql', noSchemaHandler);
  }

  if (mockSchema) {
    new ApolloServer({
      schema: mockSchema,
    }).applyMiddleware({
      app: router,
      path: '/mock/graphql',
    });

    console.log('- GraphQL mock server running at .../mock/graphql');
  } else {
    router.use('/mock/graphql', noSchemaHandler);
  }

  router.get(
    '/graphql',
    expressPlayground({
      endpoint: 'graphql',
    }),
  );

  router.use('/', (req, res, next) => {
    // this middleware makes the esClient available in all requests in a "context"
    req.context = req.context || {};
    req.context.schema = schema;
    req.context.mockSchema = mockSchema;

    return next();
  });

  console.log(' \n');

  return router;
};

export default async ({
  configsSource = '',
  enableAdmin,
  esClient,
  getServerSideFilter,
  graphqlOptions = {},
}) => {
  try {
    const configsFromFiles = await getConfigObject(configsSource);
    const typesWithMappings = await getTypesWithMappings(esClient, configsFromFiles);
    const graphQLEndpoints = await createEndpoint({
      enableAdmin,
      esClient,
      getServerSideFilter,
      graphqlOptions,
      typesWithMappings,
    });

    await initializeSets({ esClient });

    return [
      // this middleware makes the esClient and config available in all requests, in a "context" object
      (req, res, next) => {
        req.context = {
          ...req.context,
          configs: typesWithMappings?.[1],
          esClient,
        };

        return next();
      },
      graphQLEndpoints,
    ];
  } catch (error) {
    // if enpoint creation fails, follow to the next server step to respond with an error
    console.info('\n---\nError thrown while generating the GraphQL endpoints.');
    console.error(error?.message || error);

    return (req, res) =>
      res.status(500).send({
        // TODO: revisit this response
        error: 'The GraphQL server is unavailable due to an internal error',
        message: error,
      });
  }
};
