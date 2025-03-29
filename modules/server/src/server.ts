import { Client, type ClientOptions } from '@elastic/elasticsearch';
import { Router } from 'express';
import morgan from 'morgan';

import { ENABLE_LOGS, ES_ARRANGER_SET_INDEX, ENABLE_NETWORK_AGGREGATION } from './config/constants.js';
import { ENV_CONFIG } from './config/index.js';
import downloadRoutes from './download/index.js';
import getGraphQLRoutes from './graphqlRoutes.js';
import getDefaultServerSideFilter from './utils/getDefaultServerSideFilter.js';

const {
	CONFIG_FILES_PATH,
	DEBUG_MODE,
	ENABLE_ADMIN,
	ENABLE_DOCUMENT_HITS,
	ES_HOST,
	ES_USER,
	ES_PASS,
	ES_LOG, //TODO: ES doesn't include a logger anymore
	PING_PATH,
} = ENV_CONFIG;

export const buildEsClient = (esHost = '', esUser = '', esPass = '') => {
	if (!esHost) {
		console.error('no elasticsearch host was provided');
	}

	const esConfig: ClientOptions = {
		node: esHost,
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

	return new Client(esConfig);
};

export const buildEsClientViaEnv = () => {
	return buildEsClient(ES_HOST, ES_USER, ES_PASS);
};

const arrangerServer = async ({
	configsSource = CONFIG_FILES_PATH,
	enableAdmin = ENABLE_ADMIN,
	enableDocumentHits = ENABLE_DOCUMENT_HITS,
	enableNetworkAggregation = ENABLE_NETWORK_AGGREGATION,
	enableLogs = ENABLE_LOGS,
	esClient: customEsClient = undefined,
	esHost = ES_HOST,
	esPass = ES_PASS,
	esUser = ES_USER,
	getServerSideFilter = getDefaultServerSideFilter,
	graphqlOptions = {},
	pingPath = PING_PATH,
	setsIndex = ES_ARRANGER_SET_INDEX,
} = {}): Promise<Router> => {
	const esClient = customEsClient || buildEsClient(esHost, esUser, esPass);
	const router = Router();

	console.log('------------------------------------');
	console.log(
		`\nStarting Arranger server... ${enableLogs ? `(in ${enableAdmin ? 'ADMIN mode!!' : 'read-only mode.'})` : ''}`,
	);

	if (enableLogs) {
		console.log('  Extensive console logging enabled.');
		DEBUG_MODE && console.log('  (Everything but health checks)');

		router.use(
			morgan('dev', {
				skip: (req, res) => {
					// log everything but health checks on dev/debug. errors only otherwise
					return DEBUG_MODE ? req.originalUrl.includes(pingPath) : res.statusCode < 400;
				},
			}),
		);
	}

	const graphQLRoutes = await getGraphQLRoutes({
		configsSource,
		enableAdmin,
		enableDocumentHits,
		enableNetworkAggregation,
		esClient,
		getServerSideFilter,
		graphqlOptions,
		setsIndex,
	});

	router.use('/', (req, res, next) => {
		/* Context contents:
			'graphQLRoutes' provides esClient, schemas, and server configs.
			'downloadRoutes' consumes esClient, schemas, as well as download and table configs.
		*/
		req.context = req.context || {};
		return next();
	});
	router.use('/', graphQLRoutes);
	router.use(`/download`, downloadRoutes({ enableAdmin })); // consumes
	router.get('/favicon.ico', (req, res) => res.status(204));

	router.get(pingPath, (_req, res) => res.send({ message: 'Arranger is functioning correctly...' }));

	return router;
};

export default arrangerServer;
