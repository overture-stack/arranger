import 'babel-polyfill';
import express from 'express';
import { Server } from 'http';
import addProject from './addProject';
import Arranger from '@arranger/server';
import ajax from '@arranger/server/dist/utils/ajax';
import adminGraphql from '@arranger/admin/dist';
import { Client } from '@elastic/elasticsearch';

const file_centric_mapppings = require('./assets/file_centric.mappings.json');

const port = 5678;
const esHost = 'http://127.0.0.1:9200';
const esIndex = 'file_centric';

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

describe('@arranger/admin', () => {
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
      http.listen(port, () => {
        resolve();
      });
    });
  });
  after(async () => {
    http.close();
    await cleanup();
  });

  const env = {
    api,
    esIndex,
    adminPath,
  };
  addProject(env);
});
