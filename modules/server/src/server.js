import elasticsearch from '@elastic/elasticsearch';
import express from 'express';

import { CONFIG } from './config';
import downloadRoutes from './download';
import getGraphQLRoutes from './graphqlRoutes';
import getDefaultServerSideFilter from './utils/getDefaultServerSideFilter';

const { ES_HOST, ES_USER, ES_PASS, ES_LOG } = CONFIG;

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

export const buildEsClientViaEnv = () => {
  return buildEsClient(ES_HOST, ES_USER, ES_PASS, ES_LOG);
};

export default async ({
  enableAdmin = false,
  esHost = ES_HOST,
  esPass = ES_PASS,
  esUser = ES_USER,
  getServerSideFilter = getDefaultServerSideFilter,
  graphqlOptions = {},
} = {}) => {
  const esClient = buildEsClient(esHost, esUser, esPass);
  const router = express.Router();

  console.log(`Application started in ${enableAdmin ? 'ADMIN mode!!' : 'read-only mode.'}`);

  const graphQLRoutes = await getGraphQLRoutes({
    esClient,
    graphqlOptions,
    enableAdmin,
    getServerSideFilter,
  });

  router.use('/', graphQLRoutes); // also adds esClient to request context
  router.use(`/download`, downloadRoutes());
  router.get(`/ping`, (req, res) => res.status(200).send({ status: 'ok' }));

  return router;
};
