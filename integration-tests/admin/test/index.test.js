import { Client } from '@elastic/elasticsearch';
import express from 'express';

import Arranger, { adminGraphql } from '../../../modules/server/dist';
import ajax from '../../../modules/server/dist/utils/ajax';
import addProject from './addProject';

const file_centric_mapppings = require('./assets/file_centric.mappings.json');

const port = process.env.ES_PORT || 5678;
const esHost = process.env.ES_HOST || 'http://127.0.0.1:9200';
const esIndex = process.env.ES_INDEX || 'file_centric';
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

describe('@arranger/admin', () => {
  let server;
  const adminPath = '/admin/graphql';
  before(async () => {
    console.log('===== Initializing Elasticsearch data =====');
    try {
      await cleanup();
    } catch (err) {}
    await esClient.indices.create({
      index: esIndex,
      body: file_centric_mapppings,
    });

    console.log('===== Starting arranger app for test =====');
    const router = await Arranger({ esHost, enableAdmin: false });
    const adminApp = await adminGraphql({ esHost });
    adminApp.applyMiddleware({ app, path: adminPath });
    app.use(router);
    await new Promise((resolve) => {
      server = app.listen(port, () => {
        resolve();
      });
    });
  });
  after(async () => {
    server?.close();
    await cleanup();
  });

  const env = {
    api,
    esIndex,
    adminPath,
  };
  addProject(env);
});
