import 'babel-polyfill';
import express from 'express';
import { Server } from 'http';
import Arranger from '@arranger/server';
import ajax from '@arranger/server/dist/utils/ajax';
import { Client } from '@elastic/elasticsearch';
import adminGraphql from '@arranger/admin/dist';
import gql from 'graphql-tag';
import { print } from 'graphql';

// test modules
import readMetadata from './readMetadata';
import readSearchData from './readSearchData';
import readAggregation from './readAggregation';
import manageSets from './manageSets';

const mapppings = require('./assets/model_centric.mappings.json');
const data = require('./assets/model_centric.data.json');

const port = 5678;
const esHost = 'http://127.0.0.1:9200';
const esIndex = 'models';

const app = express();
const http = Server(app);

const api = ajax(`http://localhost:${port}`);
const esClient = new Client({
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
      http.listen(port, () => {
        resolve();
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
  });
  after(async () => {
    http.close();
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
