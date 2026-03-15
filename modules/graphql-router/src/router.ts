import { Client, type ClientOptions } from '@elastic/elasticsearch';
import type { ConfigsObject } from '@overture-stack/arranger-types/configs';
import { Router } from 'express';

import fallbackConfigs, { validateConfigs } from '#config/index.js';
import downloadRoutes from '#download/index.js';
import featuresFromFlags from '#features/index.js';
import getDefaultServerSideFilter, { type GetServerSideFilterFn } from '#utils/getDefaultServerSideFilter.js';
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

const arrangerServer = async ({
	configs: customConfigs = {},
	configsSource = '',
	esClient: customEsClient = undefined,
	getServerSideFilter = getDefaultServerSideFilter,
	graphqlOptions = {},
}: {
	configs: Partial<ConfigsObject>;
	configsSource?: string;
	esClient?: any; // FIXME
	getServerSideFilter?: GetServerSideFilterFn;
	graphqlOptions?: Record<string, unknown>; // FIXME
}): Promise<Router> => {
	warnDeprecatedConfigsSource(configsSource);

	console.log('\n------\nInitializing an Arranger instance:');

	const aggregatedConfigs: Partial<ConfigsObject> = {
		...fallbackConfigs,
		...customConfigs,
	};

	const validatedConfigs = validateConfigs(aggregatedConfigs);
	const {
		enableAdmin,
		enableDebug,
		enableLogs, // TODO: currently unused
		enableNetworkAggregation,
		esHost,
		esPass,
		esUser,
		...configs
	} = validatedConfigs;

	console.log(`${enableLogs ? `    (instance will run in ${enableAdmin ? 'ADMIN mode!!' : 'read-only mode'})` : ''}`);

	const esClient = customEsClient || buildEsClient(esHost, esUser, esPass);
	const router = Router();

	router.use(
		addContext({
			enableDebug,
		}),
		featuresFromFlags({ configs }),
	);

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

	return router;
};

export default arrangerServer;
