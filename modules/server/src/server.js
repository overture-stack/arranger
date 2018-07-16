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
import data from './data.json';
const path = require('path');

const currentDirectory = path.resolve(__dirname);
const params = { assdfg: 'sdfbxcgbjvn' };
const { spawn } = require('child_process');
const getExecutor = args => {
  const childProcess = spawn(
    'go',
    [
      'run',
      `${currentDirectory}/goUtils/script.go`,
      `-params=${JSON.stringify(params)}`,
    ],
    {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    },
  );
  childProcess.stdin.setEncoding('utf-8');
  return childProcess;
};

const chunkString = (str, size) => {
  const numChunks = Math.ceil(str.length / size);
  const chunks = new Array(numChunks);
  for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
    chunks[i] = str.substr(o, size);
  }
  return chunks;
};

const MAX_BUFFER_SIZE = 64 * 1024 - 1;
const chunkStart = Date.now();
const inputChunks = chunkString(JSON.stringify(data), MAX_BUFFER_SIZE);
console.log('chunk time: ', Date.now() - chunkStart);

const now = Date.now();
const goProcess = getExecutor();
goProcess.stdout.on('data', buffer => {
  const str = buffer.toString('utf8');
  try {
    const { type, payload } = JSON.parse(str);
    switch (type) {
      case 'ERROR':
        console.error('[GO_ERROR]: ', payload);
        break;
      case 'RESULT':
        console.log('[GO_RESULT]: ', payload);
        break;
      default:
        console.log(str);
    }
  } catch (err) {
    console.log('[GO_LOG]=========================');
    console.log(str);
    console.log('=================================');
  }
});
const writeToProcess = (inputChunks, i = 0) =>
  new Promise((resolve, reject) => {
    if (i < inputChunks.length) {
      goProcess.stdin.write(`${inputChunks[i]}\n`, () => {
        writeToProcess(inputChunks, i + 1).then(resolve);
      });
    } else {
      resolve();
    }
  });
writeToProcess(inputChunks).then(() => {
  goProcess.stdin.write(`INPUT_END\n`, () => {
    console.log('streamingDataToGo: ', Date.now() - now);
  });
});

let startSingleProject = async ({ io, projectId, es, graphqlOptions }) => {
  try {
    await startProject({ es, io, id: projectId, graphqlOptions });
  } catch (error) {
    console.warn(error.message);
  }
};

export default async ({
  projectId = PROJECT_ID,
  esHost = ES_HOST,
  io,
  graphqlOptions = {},
} = {}) => {
  const router = express.Router();
  router.use(bodyParser.urlencoded({ extended: false }));
  router.use(bodyParser.json({ limit: '50mb' }));

  sockets({ io });
  router.use(await watchGit({ io }));

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

  router.use('/projects', projectsRoutes({ io, graphqlOptions }));
  if (esHost) {
    const es = new elasticsearch.Client({ host: esHost });
    if (projectId) {
      startSingleProject({ io, projectId, es, graphqlOptions });
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
