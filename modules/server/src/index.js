import fs from 'fs';
import { rainbow } from 'chalk-animation';
import { Server } from 'http';
import express from 'express';
import socketIO from 'socket.io';
import bodyParser from 'body-parser';
import cors from 'cors';

import projectsRoutes from './projects';
import sockets from './sockets';
import { getProjects } from './utils/projects';
import { PORT } from './utils/config';

let main = async () => {
  let app = express();
  let http = Server(app);
  let io = socketIO(http);

  sockets({ io });

  app.use(cors());
  app.use(bodyParser.json({ limit: '50mb' }));

  app.use((req, res, next) => {
    let projects = getProjects();
    if (!projects.length) return next();
    projects.forEach(project => project.app(req, res, next));
  });

  projectsRoutes({ app, io });

  http.listen(PORT, () => rainbow(`⚡️ Listening on port ${PORT} ⚡️`));
};

main();
