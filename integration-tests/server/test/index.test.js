import { Client } from '@elastic/elasticsearch';
import express from 'express';
import { print } from 'graphql';
import gql from 'graphql-tag';

import Arranger, { adminGraphql } from '../../../modules/server/dist';
import ajax from '../../../modules/server/dist/utils/ajax';

// test modules
import readMetadata from './readMetadata';
import readSearchData from './readSearchData';
import readAggregation from './readAggregation';
import manageSets from './manageSets';

const mapppings = require('./assets/model_centric.mappings.json');
const data = require('./assets/model_centric.data.json');

const port = process.env.ES_PORT || 5678;
const esHost = process.env.ES_HOST || 'http://127.0.0.1:9200';
const esIndex = process.env.ES_INDEX || 'models';
const esPwd = process.env.ES_PASS;
const esUser = process.env.ES_USER;

const useAuth = !!esPwd && !!esUser;

const app = express();

const api = ajax(`http://localhost:${port}`);
const esClient = new Client({
  ...(useAuth && {
    auth: {
      username: esUser,
      password: esPwd,
    },
  }),
  node: esHost,
});

const cleanup = () =>
  Promise.all([
    esClient.indices.delete({
      index: esIndex,
    }),
    esClient.indices.delete({
      index: 'arranger-projects*',
    }),
  ]);

describe('@arranger/server', () => {
  let server;
  const adminPath = '/admin/graphql';
  const graphqlField = 'model';
  const projectId = 'arranger_server_test';
  before(async function () {
    console.log('===== Initializing Elasticsearch data =====');
    this.timeout(10000);
    try {
      await cleanup();
    } catch (err) {}
    await esClient.indices.create({
      index: esIndex,
      body: mapppings,
    });

    for (let datum of data) {
      await esClient.index({
        index: esIndex,
        id: datum._id,
        body: datum._source,
        refresh: 'wait_for',
      });
    }

    console.log('===== Starting arranger app for test =====');
    try {
      const router = await Arranger({
        esHost,
        enableAdmin: false,
        getServerSideFilter: () => ({
          op: 'not',
          content: [
            {
              op: 'in',
              content: {
                field: 'access_denied',
                value: ['true'],
              },
            },
          ],
        }),
      });
      const adminApp = await adminGraphql({ esHost });
      adminApp.applyMiddleware({ app, path: adminPath });
      app.use(router);

      await new Promise((resolve) => {
        server = app.listen(port, () => {
          resolve(null);
        });
      });

      /**
       * uses the admin API to adds some metadata
       */
      await api.post({
        endpoint: adminPath,
        body: {
          query: print(gql`
            mutation($projectId: String!) {
              newProject(id: $projectId) {
                id
                __typename
              }
            }
          `),
          variables: {
            projectId,
          },
        },
      });
      await api.post({
        endpoint: adminPath,
        body: {
          query: print(gql`
            mutation($projectId: String!, $graphqlField: String!, $esIndex: String!) {
              newIndex(projectId: $projectId, graphqlField: $graphqlField, esIndex: $esIndex) {
                id
              }
            }
          `),
          variables: {
            projectId,
            graphqlField,
            esIndex,
          },
        },
      });
    } catch (err) {
      throw err;
    }
  });
  after(async () => {
    server.close();
    await cleanup();
  });

  const env = {
    api,
    graphqlField,
    gqlPath: `${projectId}/graphql`,
  };

  describe('metadata reading', () => {
    readMetadata(env);
  });
  describe('search data reading', () => {
    readSearchData(env);
  });
  describe('aggregation reading', () => {
    readAggregation(env);
  });
  describe('manages sets', () => {
    manageSets(env);
  });
});
