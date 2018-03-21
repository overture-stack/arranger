import 'babel-polyfill';
import express from 'express';
import socketIO from 'socket.io';
import { Server } from 'http';
import addProject from './addProject';
import Arranger from '@arranger/server';
import ajax from '@arranger/server/dist/utils/ajax';

const port = 5678;
const esHost = 'http://127.0.0.1:9200';
const projectId = 'TEST-PROJECT';

const app = express();
const http = Server(app);
const io = socketIO(http);

const api = ajax(`http://localhost:${port}`);

describe('@arranger/server', () => {
  before(() =>
    Arranger({ io, esHost }).then(router => {
      app.use(router);
    }),
  );

  addProject({ server: http, port, esHost, api, projectId });
});
