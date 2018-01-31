import fs from 'fs';
import { promisify } from 'util';
import elasticsearch from 'elasticsearch';
import { rainbow } from 'chalk-animation';
import { Server } from 'http';
import express from 'express';
import socketIO from 'socket.io';
import uuid from 'uuid/v4';
import fetch from 'node-fetch';
import { range, flattenDeep } from 'lodash';
import bodyParser from 'body-parser';
import cors from 'cors';
import { graphqlExpress } from 'apollo-server-express';
import makeSchema from '@arranger/schema';
import {
  addMappingsToTypes,
  mappingToAggsState,
} from '@arranger/mapping-utils';
import projectsRoutes from './projects';

let writeFile = promisify(fs.writeFile);

let port = process.env.PORT || 5050;
let pingMs = process.env.PING_MS || 2200;

let main = async () => {
  let app = express();
  let http = Server(app);
  let io = socketIO(http);

  let connections = {};
  let projectStates = [];

  io.on('connection', socket => {
    connections[socket.id] === socket;

    socket.on('disconnect', () => {
      delete connections[socket.id];
      clearInterval(socket.monitorIntervalId);
    });

    socket.on('arranger::monitorProjects', ({ projects = [], eshost }) => {
      let pingProject = async () => {
        let statuses = await Promise.all(
          projects.map(x =>
            fetch(`http://localhost:${port}/${x.id}/ping`, {
              headers: {
                ES_HOST: eshost,
              },
            })
              .then(r => {
                if (r.ok) return r.text();
              })
              .then(r => {
                return { id: x.id, status: r === 'ok' ? 200 : 400 };
              })
              .catch(() => ({ id: x.id, status: 400 })),
          ),
        );

        socket.emit('server::projectsStatus', statuses);
      };

      pingProject();
      socket.monitorIntervalId = setInterval(pingProject, pingMs);
    });
  });

  app.use(cors());
  app.use(bodyParser.json({ limit: '50mb' }));

  // create request context
  app.use((req, res, next) => {
    req.context = {};
    next();
  });

  // create es client
  app.use(async (req, res, next) => {
    let { eshost } = req.body;
    let host = eshost || req.get('ES_HOST');
    if (!host) return res.json({ error: 'host must be provided' });
    try {
      req.context.es = new elasticsearch.Client({ host });
    } catch (error) {
      return res.json({ error: error.message });
    }
    next();
  });

  projectsRoutes({ app });

  global.apps = {};

  app.use((req, res, next) => {
    let routers = Object.values(apps);
    if (!routers.length) return next();
    routers.forEach(router => router(req, res, next));
  });

  http.listen(port, () => rainbow(`⚡️ Listening on port ${port} ⚡️`));
};

main();
