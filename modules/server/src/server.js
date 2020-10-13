import elasticsearch from '@elastic/elasticsearch';
import express from 'express';
import bodyParser from 'body-parser';

import projectsRoutes from './projects';
import { getProjects } from './utils/projects';
import startProject, { getDefaultServerSideFilter } from './startProject';
import { ES_HOST, ES_USER, ES_PASS, ES_LOG, PROJECT_ID, MAX_LIVE_VERSIONS } from './utils/config';
import { fetchProjects } from './projects/getProjects';

export const buildEsClientViaEnv = () => {
  return buildEsClient(ES_HOST, ES_USER, ES_PASS, ES_LOG);
};

export const buildEsClient = (esHost, esUser, esPass, esLog) => {
  if (!esHost) {
    console.error('no elasticsearch host was provided');
  }

  let esConfig = {
    node: esHost,
    log: esLog,
  };

  if (esUser) {
    if (!esPass) {
      console.error('ES user was defined, but password was not');
    }
    esConfig['auth'] = {
      username: esUser,
      password: esPass,
    };
  }
  return new elasticsearch.Client(esConfig);
};

let startSingleProject = async ({
  projectId,
  es,
  graphqlOptions,
  enableAdmin,
  getServerSideFilter,
}) => {
  try {
    await startProject({
      es,
      id: projectId,
      graphqlOptions,
      enableAdmin,
      getServerSideFilter,
    });
  } catch (error) {
    console.warn(error.message);
  }
};

export { getProjects } from './utils/projects';
export default async ({
  projectId = PROJECT_ID,
  esHost = ES_HOST,
  esUser = ES_USER,
  esPass = ES_PASS,
  graphqlOptions = {},
  enableAdmin = false,
  getServerSideFilter = getDefaultServerSideFilter,
} = {}) => {
  enableAdmin
    ? console.log('Application started in ADMIN mode!!')
    : console.log('Application started in read-only mode.');

  const es = buildEsClient(esHost, esUser, esPass);
  if (projectId) {
    startSingleProject({
      projectId,
      es,
      graphqlOptions,
      enableAdmin,
      getServerSideFilter,
    });
  } else {
    const { projects = [] } = await fetchProjects({ es });
    await Promise.all(
      projects
        .filter((project) => project.active)
        // .slice(0, MAX_LIVE_VERSIONS)
        .map(async (project) => {
          try {
            await startSingleProject({
              projectId: project.id,
              es,
              graphqlOptions,
              enableAdmin,
              getServerSideFilter,
            });
          } catch (error) {
            console.warn(error.message);
          }
        }),
    );
  }

  const router = express.Router();
  router.use(bodyParser.urlencoded({ extended: false, limit: '50mb' }));
  router.use(bodyParser.json({ limit: '50mb' }));

  // The GraphQL endpoints

  // List all projects
  router.use('/projects', projectsRoutes({ graphqlOptions, enableAdmin }));

  // Get project by ID
  router.use(
    '/:projectId',
    (req, res, next) => {
      // ========= step 1: attempt to run the existing project ==========
      const projects = getProjects();
      if (!projects.length) return next();
      const project = projects.find(
        (p) => p.id.toLowerCase() === req.params.projectId.toLowerCase(),
      );
      if (project) {
        return project.app(req, res, next);
      }
      return next();
    },
    async (req, res, next) => {
      // ========= step 2: if above fails, attempt to start the project =======
      const projectId = req.params.projectId;
      try {
        await startSingleProject({
          es,
          enableAdmin,
          graphqlOptions,
          projectId,
          getServerSideFilter,
        });
        const project = getProjects().find(
          (p) => p.id.toLowerCase() === req.params.projectId.toLowerCase(),
        );
        return project.app(req, res, next);
      } catch (err) {
        return next();
      }
    },
    (req, res) => {
      // ========= step 3: if above fails, respond with error code =======
      return res.status(400).send({
        error: `no project with id ${req.params.projectId} is available`,
      });
    },
  );

  return router;
};
