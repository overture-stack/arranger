import { Router } from 'express';
import morgan from 'morgan';

import { ENABLE_LOGS, ES_ARRANGER_SET_INDEX, ENABLE_NETWORK_AGGREGATION } from './config/constants.js';
import { ENV_CONFIG } from './config/index.js';
import downloadRoutes from './download/index.js';
import getGraphQLRoutes from './graphqlRoutes.js';
import getSearchClient from './searchClient/index.js';
import { type SearchConfig } from './searchClient/types.js';
import getDefaultServerSideFilter from './utils/getDefaultServerSideFilter.js';

const { CONFIG_FILES_PATH, DEBUG_MODE, ENABLE_ADMIN, ES_HOST, ES_USER, ES_PASS, PING_PATH, SEARCH_CLIENT } = ENV_CONFIG;

export const createSearchConfig = (host = '', username = '', password = '', clientType = '') => {
	if (!host) {
		throw new Error('Search Client host URL was not provided');
	}
	const auth =  (username && password) ? { username, password } : undefined;
	const searchConfig: SearchConfig = {
		node: host,
		auth,
		clientType,
	};

	return searchConfig;
};

export const buildSearchClient = async (host: string, user: string, password: string, clientType: string) => {
	const config = createSearchConfig(host, user, password, clientType);
	return await getSearchClient(config);
};

const arrangerServer = async ({
	configsSource = CONFIG_FILES_PATH,
	enableAdmin = ENABLE_ADMIN,
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
	searchClient = SEARCH_CLIENT,
} = {}): Promise<Router> => {
	const esClient = customEsClient || (await buildSearchClient(esHost, esUser, esPass, searchClient));
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
