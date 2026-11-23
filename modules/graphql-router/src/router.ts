import type { ConfigsObject, GetServerSideFilterFn } from '@overture-stack/arranger-types/configs';
import {
	configFeatureFlagProperties,
	configOptionalProperties,
	configRootProperties,
} from '@overture-stack/arranger-types/configs/constants';
import { Router, type RequestHandler } from 'express';
import { merge } from 'lodash-es';

import {
	ACCESS_CONTROL_RECORD,
	type AccessControlRecord,
	createAccessControlRecord,
	describeAccessControlRecord,
} from '#accessControl/accessControlRecord.js';
import { assertFilterCallback } from '#accessControl/filterCallback.js';
import enforceAccessControl from '#accessControl/index.js';
import fallbackConfigs, { validateConfigs } from '#config/index.js';
import refuseDisabledDownloads from '#download/disableDownloads.js';
import downloadRoutes from '#download/index.js';
import getGraphQLRoutes, { FALLBACK_LABEL, isFallbackLabel, logSeparator } from '#graphqlRoutes.js';
import { createIndexProbe, type IndexProbe } from '#indexProbe.js';
import { buildCatalogueIntrospectionBody } from '#introspection/buildCatalogueIntrospection.js';
import getNestedFields from '#mapping/getNestedFields.js';
import resolveCatalogueFields from '#mapping/resolveCatalogueFields.js';
import { getIndexMapping } from '#searchClient/index.js';
import buildSearchClient, { type SearchClient } from '#searchClient/index.js';
import { type GetRequesterFn, narrowsSetRecords } from '#sets/setsAccess.js';
import type { ArrangerBaseContext } from '#types.js';
import { addArrangerLocals, keepRequestContextView } from '#utils/context.js';
import { MIGRATION_GUIDE_URL } from '#utils/migrationGuide.js';

export const mergeConfigs = <Context extends ArrangerBaseContext>(
	fallback: Partial<ConfigsObject<Context>>,
	custom: Partial<ConfigsObject<Context>>,
): Partial<ConfigsObject<Context>> => merge({}, fallback, custom);

/** Resolves the identifier used in log output for this catalogue: an explicit `catalogueId`, falling back to `documentType`, then to a generic placeholder when neither is available. */
export const resolveLabel = ({ catalogueId, documentType }: { catalogueId?: string; documentType?: string }): string =>
	catalogueId || documentType || FALLBACK_LABEL;

/**
 * The middleware every request meets first: it keeps `req.context` as a view of `res.locals.arranger`,
 * records the router's access-control decision and debug flag there, then applies the request-level
 * controls `configs` enables.
 */
export const createRequestPreprocessingMiddleware = <Context extends ArrangerBaseContext>({
	accessControlRecord,
	configs,
	enableDebug,
}: {
	accessControlRecord: AccessControlRecord<Context>;
	configs: Partial<ConfigsObject<Context>>;
	enableDebug?: boolean;
}): RequestHandler[] => [
	keepRequestContextView,
	addArrangerLocals({
		[ACCESS_CONTROL_RECORD]: accessControlRecord,
		enableDebug,
	}),
	enforceAccessControl({ configs }),
];

// TODO: for multicatalogue, serverSideFilters may be also "per catalogue"
// i.e. each catalogue may have their own, with no global filters
// question: should global filters be allowed?

/**
 * Builds the router serving one catalogue: its GraphQL endpoint, introspection and downloads.
 *
 * @param getServerSideFilter the access-control filter callback every read applies, which must be a
 *   non-async function. Left out, the router applies `includeEverything` and records the choice as
 *   defaulted rather than configured; any other value makes construction reject.
 * @param getRequester who made a request, read from the same context and stated explicitly: a principal with its
 *   id, an anonymous request or a suspended principal. Given, saved sets have owners: each set records how it was
 *   saved, the sets connection lists a principal its own sets and the sets with no owner, and a principal's set's
 *   stored filter and creator go to that principal alone. Without it, sets have no owners, as in 3.0.x.
 */
const arrangerRouter = async <Context extends ArrangerBaseContext>({
	catalogueId,
	configs: customConfigs = {},
	configsSource,
	esClient: customEsClient = undefined,
	getRequester,
	getServerSideFilter,
	graphqlOptions = {},
	onIndexMapping,
}: {
	/** Identifies this catalogue in log output, so concurrent multicatalogue loads are distinguishable. Falls back to `documentType` when not provided. */
	catalogueId?: string;
	configs: Partial<ConfigsObject<Context>>;
	/**
	 * @deprecated Not read, since the search server now reads configuration files: pass the configuration
	 * as `configs`. Passed with no `configs`, construction rejects; beside them, it is ignored with a warning.
	 */
	configsSource?: string;
	esClient?: SearchClient;
	getRequester?: GetRequesterFn<Context>;
	getServerSideFilter?: GetServerSideFilterFn<Context>;
	graphqlOptions?: Record<string, unknown>; // FIXME
	/**
	 * Called once with a copy of the index mapping the router fetched, before the router resolves, so a
	 * host can check fields against it, and with a probe for the checks the mapping cannot answer. The
	 * probe stays usable after the hook returns. A throw fails this router's construction.
	 */
	onIndexMapping?: (mappingFromIndex: Record<string, unknown>, indexProbe: IndexProbe) => void;
}): Promise<Router> => {
	// A router given only a path would start with no configuration, so that case is refused; beside
	// `configs`, the path is ignored and the router builds from them.
	if (configsSource) {
		const hasConfigs = Object.keys(customConfigs).length > 0;

		if (hasConfigs) {
			process.emitWarning(
				`arrangerRouter: "configsSource" is not read, and is deprecated: the router builds from \`configs\`. See ${MIGRATION_GUIDE_URL}#arranger-server-package`,
				{ code: 'ARRANGER_CONFIGS_SOURCE', type: 'DeprecationWarning' },
			);
		} else {
			throw new Error(
				`arrangerRouter no longer reads "configsSource": pass the configuration as \`configs\` instead. See ${MIGRATION_GUIDE_URL}#arranger-server-package`,
			);
		}
	}

	const aggregatedConfigs = mergeConfigs(fallbackConfigs, customConfigs);
	const label = resolveLabel({ catalogueId, documentType: aggregatedConfigs[configRootProperties.DOCUMENT_TYPE] });

	// TODO: set up a real logger... winston or pino?
	console.log(
		`\n${logSeparator(label)}\nInitializing an Arranger instance${isFallbackLabel(label) ? '' : ` for "${label}"`}:`,
	);

	try {
		assertFilterCallback({ getServerSideFilter, optional: true, receiver: 'arrangerRouter' });

		const accessControlRecord = createAccessControlRecord(getServerSideFilter);

		console.log(
			'server_side_filter.startup',
			`server-side filter: ${describeAccessControlRecord(accessControlRecord)}`,
			{ catalogue: label },
		);

		if (getRequester !== undefined && typeof getRequester !== 'function') {
			throw new Error(
				`arrangerRouter: getRequester must be a function when given, and was ${typeof getRequester}.`,
			);
		}

		if (narrowsSetRecords(accessControlRecord.getServerSideFilter) && getRequester === undefined) {
			console.info(
				'sets.unowned',
				"No getRequester is given, so saved sets have no owner: every reader is listed every set with its filter, while each set's records stay narrowed by the server-side filter.",
				{ catalogue: label },
			);
		}

		const { enableAdmin, enableDebug, esHost, esPass, esUser, searchEngine, ...configs } = validateConfigs(
			aggregatedConfigs,
			customEsClient,
		);

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
			nestingPrefix: configs[configOptionalProperties.NESTING_PREFIX],
			searchClient: esClient,
			esIndex: configs[configRootProperties.ES_INDEX],
		});

		onIndexMapping?.(
			structuredClone(mappingFromIndex),
			createIndexProbe({
				index: configs[configRootProperties.ES_INDEX],
				nestedFieldNames: getNestedFields(mappingFromIndex),
				nestingPrefix: configs[configOptionalProperties.NESTING_PREFIX],
				searchClient: esClient,
			}),
		);

		const resolvedFields = resolveCatalogueFields(
			mappingFromIndex,
			configs[configOptionalProperties.EXTENDED] ?? [],
		);

		const router = Router();

		router.use(createRequestPreprocessingMiddleware({ accessControlRecord, configs, enableDebug }));

		const introspectionBody = buildCatalogueIntrospectionBody({
			catalogId: configs[configOptionalProperties.CATALOG_ID] ?? '',
			description: configs[configOptionalProperties.DESCRIPTION],
			documentType: configs[configRootProperties.DOCUMENT_TYPE] ?? '',
			resolvedFields,
		});

		router.get('/introspection', (_req, res) => res.json(introspectionBody));

		const graphQLRoutes = await getGraphQLRoutes({
			configs,
			enableAdmin,
			enableDebug,
			esClient,
			getRequester,
			getServerSideFilter: accessControlRecord.getServerSideFilter, // TODO: Extend for multicatalogue per-catalogue filters
			graphqlOptions,
			label,
			mappingFromIndex,
			rethrowOnError: true,
		});

		router.use('/', graphQLRoutes);
		router.use(
			`/download`,
			configs[configFeatureFlagProperties.DISABLE_DOWNLOADS]
				? refuseDisabledDownloads()
				: downloadRoutes({ getRequester }),
		);
		router.get('/favicon.ico', (req, res) => res.status(204));

		return router;
	} catch (err) {
		// The full error (stack trace, cause chain) is debug-only noise once a caller classifies
		// and logs this failure itself (see classifyCatalogueFailureReason); this rethrow's cause
		// still carries the original error for that classification to inspect.
		aggregatedConfigs.enableDebug &&
			console.error(
				`\n${logSeparator(label)}\nError initializing Arranger instance${isFallbackLabel(label) ? '' : ` for "${label}"`}:`,
				err,
			);
		throw new Error('Failed to initialize Arranger server', { cause: err });
	}
};

export default arrangerRouter;
