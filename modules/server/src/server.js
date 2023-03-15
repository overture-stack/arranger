import elasticsearch from '@elastic/elasticsearch';
import express from 'express';
import morgan from 'morgan';

import { ENV_CONFIG } from './config';
import { ENABLE_LOGS } from './config/constants';
import downloadRoutes from './download';
import getGraphQLRoutes from './graphqlRoutes';
import getDefaultServerSideFilter from './utils/getDefaultServerSideFilter';

const {
	CONFIG_FILES_PATH,
	DEBUG_MODE,
	ENABLE_ADMIN,
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

	const esConfig = {
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

	return new elasticsearch.Client(esConfig);
};

export const buildEsClientViaEnv = () => {
	return buildEsClient(ES_HOST, ES_USER, ES_PASS);
};

export default async ({
	configsSource = CONFIG_FILES_PATH,
	enableAdmin = ENABLE_ADMIN,
	enableLogs = ENABLE_LOGS,
	esClient: customEsClient = undefined,
	esHost = ES_HOST,
	esPass = ES_PASS,
	esUser = ES_USER,
	getServerSideFilter = getDefaultServerSideFilter,
	graphqlOptions = {},
	pingPath = PING_PATH,
} = {}) => {
	const esClient = customEsClient || buildEsClient(esHost, esUser, esPass);
	const router = express.Router();

	console.log('------------------------------------');
	console.log(
		`\nStarting Arranger server... ${
			enableLogs ? `(in ${enableAdmin ? 'ADMIN mode!!' : 'read-only mode.'})` : ''
		}`,
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
		esClient,
		getServerSideFilter,
		graphqlOptions,
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
	router.use(`/download`, downloadRoutes()); // consumes

	router.get(pingPath, (_req, res) =>
		res.send({ message: 'Arranger is functioning correctly...' }),
	);

	return router;
};
