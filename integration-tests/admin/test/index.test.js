import 'babel-polyfill';
import express from 'express';
import { Server } from 'http';
import addProject from './addProject';
import Arranger from '@arranger/server';
import ajax from '@arranger/server/dist/utils/ajax';
import adminGraphql from '@arranger/admin/dist';
import { Client } from '@elastic/elasticsearch';
import { resolve } from 'dns';

const port = 5678;
const esHost = 'http://127.0.0.1:9200';

const app = express();
const http = Server(app);

const api = ajax(`http://localhost:${port}`);
const esClient = new Client({
  node: esHost,
});

describe('@arranger/admin', () => {
  const adminPath = '/admin/graphql';
  before(async () => {
    const router = await Arranger({ esHost, enableAdmin: false });
    const adminApp = await adminGraphql({ esHost });
    adminApp.applyMiddleware({ app, path: adminPath });
    app.use(router);
  });
  afterEach(() => {
    http.close();
  });
  beforeEach(
    () =>
      new Promise(resolve => {
        http.listen(port, () => {
          resolve();
        });
      }),
  );
  after(async () => {
    esClient.indices.delete({
      index: 'arranger-projects*',
    });
  });

  const env = {
    api,
    adminPath,
  };
  addProject(env);
});
