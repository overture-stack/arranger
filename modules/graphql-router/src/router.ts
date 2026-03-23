import { Client, type ClientOptions } from '@elastic/elasticsearch';
import type { ConfigsObject, GetServerSideFilterFn } from '@overture-stack/arranger-types/configs';
import { Router, type RequestHandler } from 'express';

import enforceAccessControl, { getDefaultServerSideFilter } from '#accessControl/index.js';
import fallbackConfigs, { validateConfigs } from '#config/index.js';
import downloadRoutes from '#download/index.js';
import { warnDeprecatedConfigsSource } from '#utils/noops.js';

import getGraphQLRoutes from './graphqlRoutes.js';
import { addContext } from './utils/context.js';

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

export const createRequestPreprocessingMiddleware = ({
	configs,
	enableDebug,
}: {
	configs: Partial<ConfigsObject>;
	enableDebug: boolean;
}): RequestHandler[] => [
	addContext({
		enableDebug,
	}),
	enforceAccessControl({ configs }),
];

// TODO: for multicatalog, serverSideFilters may be also "per catalog"
// i.e. each catalog may have their own, with no global filters
// question: should global filters be allowed?

const arrangerServer = async ({
	configs: customConfigs = {},
	configsSource = '',
	esClient: customEsClient = undefined,
	getServerSideFilter = getDefaultServerSideFilter,
	graphqlOptions = {},
}: {
	configs: Partial<ConfigsObject>;
	configsSource?: string; // TODO: to be removed in v3.2
	esClient?: Client;
	getServerSideFilter?: GetServerSideFilterFn;
	graphqlOptions?: Record<string, unknown>; // FIXME
}): Promise<Router> => {
	console.log('\n------\nInitializing an Arranger instance:');
	const router = Router();

	try {
		const aggregatedConfigs: Partial<ConfigsObject> = {
			...fallbackConfigs,
			...customConfigs,
		};

		const { enableAdmin, enableDebug, enableNetworkAggregation, esHost, esPass, esUser, ...configs } =
			validateConfigs(aggregatedConfigs, customEsClient);

		warnDeprecatedConfigsSource({ configsSource, enableDebug: aggregatedConfigs.enableDebug });

		enableAdmin && console.log('    Instance will run in ADMIN mode!!');
		// TODO: research and document what that means

		const esClient = customEsClient || buildEsClient(esHost, esUser, esPass);

		router.use(createRequestPreprocessingMiddleware({ configs, enableDebug }));

		// TODO: extract mapping logic from this, so it can be used in other endpoints
		const graphQLRoutes = await getGraphQLRoutes({
			configs,
			enableAdmin,
			enableDebug,
			enableNetworkAggregation,
			esClient,
			getServerSideFilter,
			graphqlOptions,
		});

		router.use('/', graphQLRoutes);
		router.use(
			`/download`,
			downloadRoutes({
				enableAdmin,
				enableDebug,
			}),
		); // consumes
		router.get('/favicon.ico', (req, res) => res.status(204));
	} catch (err) {
		console.log('\n------');
		console.error(err);
		// TODO: create a fallback route to indicate the server needs attention
		router.get('/');
	}

	return router;
};

export default arrangerServer;
