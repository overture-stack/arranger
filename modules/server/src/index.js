import fs from 'fs';
import elasticsearch from 'elasticsearch';
import { rainbow } from 'chalk-animation';
import { Server } from 'http';
import express from 'express';
import socketIO from 'socket.io';
import bodyParser from 'body-parser';
import cors from 'cors';

import projectsRoutes from './projects';
import sockets from './sockets';
import watchGit from './watchGit';
import { getProjects } from './utils/projects';
import startProject from './startProject';
import { PORT, ES_HOST, PROJECT_ID } from './utils/config';

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
    startSingleProject({ io, app });
  }
};

let startSingleProject = async ({ app, io }) => {
  sockets({ io });

  const projectApp = await startProject({
    es: new elasticsearch.Client({ host: ES_HOST }),
    io,
    id: PROJECT_ID,
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
