import elasticsearch from 'elasticsearch';
import express from 'express';
import bodyParser from 'body-parser';

import adminGraphql from '@arranger/admin/dist';
import projectsRoutes from './projects';
import { getProjects } from './utils/projects';
import startProject from './startProject';
import { ES_HOST, PROJECT_ID, MAX_LIVE_VERSIONS } from './utils/config';
import { fetchProjects } from './projects/getProjects';

let startSingleProject = async ({ projectId, es, graphqlOptions }) => {
  try {
    await startProject({ es, id: projectId, graphqlOptions });
  } catch (error) {
    console.warn(error.message);
  }
};

export default async ({
  projectId = PROJECT_ID,
  esHost = ES_HOST,
  graphqlOptions = {},
} = {}) => {
  const router = express.Router();
  router.use(bodyParser.urlencoded({ extended: false, limit: '50mb' }));
  router.use(bodyParser.json({ limit: '50mb' }));

  // The GraphQL endpoint
  const adminPath = '/admin/graphql';
  adminGraphql().applyMiddleware({ app: router, path: adminPath });
  console.log(`Admin API available at: [arranger_root]${adminPath}`);

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

  router.use('/projects', projectsRoutes({ graphqlOptions }));
  if (esHost) {
    const es = new elasticsearch.Client({ host: esHost });
    if (projectId) {
      startSingleProject({ projectId, es, graphqlOptions });
    } else {
      const { projects = [] } = await fetchProjects({ es });

      await Promise.all(
        projects
          .filter(project => project.active)
          .slice(0, MAX_LIVE_VERSIONS)
          .map(async project => {
            try {
              await startSingleProject({
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
