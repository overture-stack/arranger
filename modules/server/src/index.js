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

let app = express();
let http = Server(app);
let io = socketIO(http);

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

main({ io, app });

http.listen(PORT, () => rainbow(`⚡️ Listening on port ${PORT} ⚡️`));
