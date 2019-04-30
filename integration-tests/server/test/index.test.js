import 'babel-polyfill';
import express from 'express';
import { Server } from 'http';
import addProject from './addProject';
import saveSet from './saveSet';
import Arranger from '@kfarranger/server';
import ajax from '@kfarranger/server/dist/utils/ajax';

const port = 5678;
const esHost = 'http://127.0.0.1:9200';
const projectId = 'TEST-PROJECT';

const app = express();
const http = Server(app);

const api = ajax(`http://localhost:${port}`);

describe('@kfarranger/server', () => {
  before(() =>
    Arranger({ esHost, enableAdmin: true }).then(router => {
      app.use(router);
    }),
  );

  const env = { server: http, port, esHost, api, projectId };
  addProject(env);
  saveSet(env); // TODO
});
