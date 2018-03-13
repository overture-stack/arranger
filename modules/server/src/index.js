import 'babel-polyfill';
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

let main = async ({ io, app, projectId, esHost, port }) => {
  sockets({ io });
  watchGit({ app, io });

  app.use('/:projectId', (req, res, next) => {
    let projects = getProjects();
    if (!projects.length) return next();
    let project = projects.find(
      p => p.id.toLowerCase() === req.params.projectId.toLowerCase(),
    );
    if (project) {
      return project.app(req, res, next);
    }
    next();
  });

  projectsRoutes({ app, io });

  if (projectId && esHost) {
    startSingleProject({ io, app, projectId });
  }

  if (!projectId && esHost) {
    let projects;
    try {
      let data = await fetch(`http://localhost:${port}/projects`, {
        headers: { ES_HOST: esHost },
      }).then(r => r.json());

      projects = data.projects;
    } catch (error) {
      console.warn(error);
    }

    projects
      ?.filter(project => project.active)
      .slice(0, MAX_LIVE_VERSIONS)
      .forEach(project => {
        try {
          startSingleProject({ io, app, projectId: project.id });
        } catch (error) {
          console.warn(error.message);
        }
      });
  }
};

let startSingleProject = async ({ app, io, projectId }) => {
  let projectApp;

  try {
    projectApp = await startProject({
      es: new elasticsearch.Client({ host: ES_HOST }),
      io,
      id: projectId,
    });
  } catch (error) {
    console.warn(error.message);
    projectApp = null;
  }
};

export default ({ projectId = PROJECT_ID, esHost = ES_HOST } = {}) => {
  let app = express();
  app.use(cors());
  app.use(bodyParser.json({ limit: '50mb' }));

  let http = Server(app);
  let io = socketIO(http);

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
      this.http.listen(port, async () => {
        await main({ io, app, projectId, esHost, port });
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
