import fs from 'fs';
import { exec } from 'child_process';
import elasticsearch from 'elasticsearch';
import { rainbow } from 'chalk-animation';
import { Server } from 'http';
import express from 'express';
import socketIO from 'socket.io';
import bodyParser from 'body-parser';
import cors from 'cors';

import projectsRoutes from './projects';
import sockets from './sockets';
import { getProjects } from './utils/projects';
import startProject from './startProject';
import { PORT, ES_HOST, PROJECT_ID } from './utils/config';

let github = {};

let main = async ({ io, app }) => {
  sockets({ io });

  exec('git rev-parse --abbrev-ref HEAD', (err, branch) => {
    if (!err) github.branch = branch.trim();
  });

  exec('git rev-parse HEAD', (err, commit) => {
    if (!err) github.commit = commit.trim();
  });

  app.post('/github', (req, res) => {
    let branch = req.body.ref
      .split('/')
      .pop()
      .trim();

    let commit = req.body.after.trim();

    if (branch === github.branch && commit !== github.commit) {
      exec(
        'git pull && npm i && npm run bootstrap -- --scope @arranger/server --include-filtered-dependencies && pm2 restart kf-api',
        err => {
          if (err) throw err;
        },
      );
    }

    res.json({ message: 'restarting api' });
  });

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
