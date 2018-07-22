import elasticsearch from 'elasticsearch';
import express from 'express';
import bodyParser from 'body-parser';
import projectsRoutes from './projects';
import sockets from './sockets';
import watchGit from './watchGit';
import { getProjects } from './utils/projects';
import startProject from './startProject';
import { ES_HOST, PROJECT_ID, MAX_LIVE_VERSIONS } from './utils/config';
import { fetchProjects } from './projects/getProjects';

let startSingleProject = async ({
  io,
  ioSocket,
  projectId,
  es,
  graphqlOptions,
}) => {
  try {
    await startProject({ es, io, ioSocket, id: projectId, graphqlOptions });
  } catch (error) {
    console.warn(error.message);
  }
};

export default async ({
  projectId = PROJECT_ID,
  esHost = ES_HOST,
  ioSocket,
  io,
  graphqlOptions = {},
} = {}) => {
  const router = express.Router();
  router.use(bodyParser.urlencoded({ extended: false }));
  router.use(bodyParser.json({ limit: '50mb' }));

  sockets({ io, ioSocket });
  router.use(await watchGit({ io, ioSocket }));

  router.use('/:projectId', (req, res, next) => {
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

  router.use('/projects', projectsRoutes({ io, ioSocket, graphqlOptions }));
  if (esHost) {
    const es = new elasticsearch.Client({ host: esHost });
    if (projectId) {
      startSingleProject({ io, ioSocket, projectId, es, graphqlOptions });
    } else {
      const { projects = [] } = await fetchProjects({ es });

      await Promise.all(
        projects
          .filter(project => project.active)
          .slice(0, MAX_LIVE_VERSIONS)
          .map(async project => {
            try {
              await startSingleProject({
                io,
                ioSocket,
                projectId: project.id,
                es,
                graphqlOptions,
              });
            } catch (error) {
              console.warn(error.message);
            }
          }),
      );
    }
  }

  return router;
};
