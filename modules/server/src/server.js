import elasticsearch from '@elastic/elasticsearch';
import express from 'express';
import morgan from 'morgan';

import { CONFIG } from './config';
import { ENABLE_LOGS } from './config/constants';
import downloadRoutes from './download';
import getGraphQLRoutes from './graphqlRoutes';
import getDefaultServerSideFilter from './utils/getDefaultServerSideFilter';

const { CONFIG_FILES_PATH, ES_HOST, ES_USER, ES_PASS, ES_LOG, PING_PATH } = CONFIG;

export const buildEsClient = (esHost = '', esUser = '', esPass = '', esLog = 'error') => {
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

export const buildEsClientViaEnv = () => {
  return buildEsClient(ES_HOST, ES_USER, ES_PASS, ES_LOG);
};

export default async ({
  configsSource = CONFIG_FILES_PATH,
  enableAdmin = false,
  enableLogs = ENABLE_LOGS,
  esHost = ES_HOST,
  esPass = ES_PASS,
  esUser = ES_USER,
  getServerSideFilter = getDefaultServerSideFilter,
  graphqlOptions = {},
  pingPath = PING_PATH,
} = {}) => {
  const esClient = buildEsClient(esHost, esUser, esPass);
  const router = express.Router();
  enableLogs && console.log('Extensive Logging enabled');

  console.log(
    `Starting Arranger server... ${
      enableLogs ? `(in ${enableAdmin ? 'ADMIN mode!!' : 'read-only mode.'}` : ''
    }`,
  );

  enableLogs &&
    router.use(
      morgan('dev', {
        skip: (req, res) => {
          // logs everything but health checks on dev, errors only otherwise
          return process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true'
            ? req.originalUrl.includes(pingPath)
            : res.statusCode < 400;
        },
      }),
    );

  const graphQLRoutes = await getGraphQLRoutes({
    configsSource,
    esClient,
    graphqlOptions,
    enableAdmin,
    getServerSideFilter,
  });

  router.use('/', graphQLRoutes); // also adds esClient to request context
  router.use(`/download`, downloadRoutes());

  router.get(pingPath, (_req, res) =>
    res.send({ message: 'Arranger is functioning correctly...' }),
  );

  return router;
};
