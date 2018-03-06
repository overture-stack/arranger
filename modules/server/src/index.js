import fs from 'fs';
import elasticsearch from 'elasticsearch';
import { rainbow } from 'chalk-animation';
import { Server } from 'http';
import express from 'express';
import socketIO from 'socket.io';
import bodyParser from 'body-parser';
import cors from 'cors';
import fetch from 'node-fetch';

import projectsRoutes from './projects';
import sockets from './sockets';
import watchGit from './watchGit';
import { getProjects } from './utils/projects';
import startProject from './startProject';
import { PORT, ES_HOST, PROJECT_ID, MAX_LIVE_VERSIONS } from './utils/config';

let main = async ({ io, app }) => {
  sockets({ io });
  watchGit({ app, io });

  app.use((req, res, next) => {
    let projects = getProjects();
    if (!projects.length) return next();
    projects.forEach(project => project.app(req, res, next));
  });

  projectsRoutes({ app, io });

  if (PROJECT_ID && ES_HOST) {
    startSingleProject({ io, app, projectId: PROJECT_ID });
  }

  if (!PROJECT_ID && ES_HOST) {
    let projects;
    try {
      let data = await fetch(`http://localhost:${PORT}/projects`, {
        headers: { ES_HOST },
      }).then(r => r.json());

      projects = data.projects;
    } catch (error) {
      console.warn(error);
    }

    projects
      .filter(project => project.active)
      .slice(0, MAX_LIVE_VERSIONS)
      .forEach(project =>
        startSingleProject({ io, app, projectId: project.id }),
      );
  }
};

let startSingleProject = async ({ app, io, projectId }) => {
  sockets({ io });

  const projectApp = await startProject({
    es: new elasticsearch.Client({ host: ES_HOST }),
    io,
    id: projectId,
  });

  app.use('/', projectApp);
};

export default () => {
  let app = express();
  app.use(cors());
  app.use(bodyParser.json({ limit: '50mb' }));

  let http = Server(this.app);
  let io = socketIO(this.http);

  main({ io, app });

  let server = {
    app,
    io,
    http,
    status: 'off',
    listen(
      port = PORT,
      cb = () => {
        rainbow(`⚡️ Listening on port ${port} ⚡️`);
      },
    ) {
      this.http.listen(port, () => {
        this.status = 'on';
        cb();
      });
    },
    close(cb = () => {}) {
      if (this.http) {
        this.http.close(() => {
          this.status = 'off';
          cb();
        });
      } else {
        throw '❗️ cannot close server that has not been started ❗️';
      }
    },
  };

  return server;
};
