import type { ConfigsObject, GetServerSideFilterFn } from '@overture-stack/arranger-types/configs';
import { configOptionalProperties, configRootProperties } from '@overture-stack/arranger-types/configs/constants';
import { Router, type RequestHandler } from 'express';

import enforceAccessControl, { getDefaultServerSideFilter } from '#accessControl/index.js';
import fallbackConfigs, { validateConfigs } from '#config/index.js';
import downloadRoutes from '#download/index.js';
import getGraphQLRoutes from '#graphqlRoutes.js';
import { getIndexMapping } from '#searchClient/index.js';
import { buildCatalogueIntrospectionBody } from '#introspection/buildCatalogueIntrospection.js';
import resolveCatalogueFields from '#mapping/resolveCatalogueFields.js';
import buildSearchClient, { type SearchClient } from '#searchClient/index.js';
import type { ArrangerBaseContext } from '#types.js';
import { addContext } from '#utils/context.js';
import { warnDeprecatedConfigsSource } from '#utils/noops.js';

export const createRequestPreprocessingMiddleware = <Context extends ArrangerBaseContext>({
	configs,
	enableDebug,
}: {
	configs: Partial<ConfigsObject<Context>>;
	enableDebug?: boolean;
}): RequestHandler[] => [
	addContext({
		enableDebug,
	}),
	enforceAccessControl({ configs }),
];

// TODO: for multicatalog, serverSideFilters may be also "per catalog"
// i.e. each catalog may have their own, with no global filters
// question: should global filters be allowed?

const arrangerRouter = async <Context extends ArrangerBaseContext>({
	configs: customConfigs = {},
	configsSource = '',
	esClient: customEsClient = undefined,
	getServerSideFilter = getDefaultServerSideFilter,
	graphqlOptions = {},
}: {
	configs: Partial<ConfigsObject<Context>>;
	configsSource?: string; // TODO: remove by v3.2
	esClient?: SearchClient;
	getServerSideFilter?: GetServerSideFilterFn<Context>;
	graphqlOptions?: Record<string, unknown>; // FIXME
}): Promise<Router> => {
	// TODO: set up a real logger... winston or pino?
	console.log('\n------\nInitializing an Arranger instance:');

	try {
		const aggregatedConfigs: Partial<ConfigsObject<Context>> = {
			...fallbackConfigs,
			...customConfigs,
		};

		const { enableAdmin, enableDebug, esHost, esPass, esUser, searchEngine, ...configs } = validateConfigs(
			aggregatedConfigs,
			customEsClient,
		);

		warnDeprecatedConfigsSource({ configsSource, enableDebug: aggregatedConfigs.enableDebug });

		enableAdmin && console.log('    Instance will run in ADMIN mode!!');
		// TODO: research and document what that means

		const esClient =
			customEsClient ||
			(await buildSearchClient({
				client: searchEngine,
				node: esHost,
				password: esPass,
				username: esUser,
			}));

		const mappingFromIndex = await getIndexMapping({
			enableDebug,
			searchClient: esClient,
			esIndex: configs[configRootProperties.ES_INDEX],
		});

		const resolvedFields = resolveCatalogueFields(
			mappingFromIndex,
			configs[configOptionalProperties.EXTENDED] ?? [],
		);

		const router = Router();

		router.use(createRequestPreprocessingMiddleware({ configs, enableDebug }));

		const introspectionBody = buildCatalogueIntrospectionBody({
			catalogId: configs[configOptionalProperties.CATALOG_ID] ?? '',
			documentType: configs[configRootProperties.DOCUMENT_TYPE] ?? '',
			resolvedFields,
		});

		router.get('/introspection', (_req, res) => res.json(introspectionBody));

		const graphQLRoutes = await getGraphQLRoutes({
			configs,
			enableAdmin,
			enableDebug,
			esClient,
			getServerSideFilter, // TODO: Extend for multicatalog per-catalog filters
			graphqlOptions,
			mappingFromIndex,
		});

		router.use('/', graphQLRoutes);
		router.use(
			`/download`,
			downloadRoutes({
				enableDebug,
			}),
		); // consumes
		router.get('/favicon.ico', (req, res) => res.status(204));

		return router;
	} catch (err) {
		console.error('\n------\nError initializing Arranger instance:', err);
		// TODO: create a fallback route to indicate the server needs attention
		throw new Error('Failed to initialize Arranger server'); // Rethrow for better error propagation
	}
};

export default arrangerRouter;
