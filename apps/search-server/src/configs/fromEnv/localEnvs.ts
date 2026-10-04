import type { SearchEngineType } from '@overture-stack/arranger-types/configs';
import {
	configFeatureFlagProperties,
	configOptionalProperties,
	configRootProperties,
	downloadProperties,
	setsProperties,
	tableDefaults,
	tableProperties,
} from '@overture-stack/arranger-types/configs/constants';
import { stringToBool, stringToNumber } from '@overture-stack/arranger-types/tools';

import { parseEnableAccessControl } from './enableAccessControl.js';
import { resolveRenamedEnvs } from './renamedEnvs.js';

// A 3.0 deployment's variable names keep working as deprecated aliases, each warned about once, at startup.
const { env, notices } = resolveRenamedEnvs(process.env);
notices.forEach(({ code, message }) => process.emitWarning(message, { code, type: 'DeprecationWarning' }));

// TODO: make a more robust isProd helper (e.g. casing + alternatives like 'prod')
const isProd = env.NODE_ENV === 'production';

const isSearchEngineType = (value: string | undefined): value is SearchEngineType =>
	value === 'elasticsearch' || value === 'opensearch';

/** Validates SEARCH_ENGINE against the supported engines at the env-var boundary; an unrecognized value is warned about here rather than silently passed through or silently dropped. */
const parseSearchEngine = (value: string | undefined): SearchEngineType | undefined => {
	if (isSearchEngineType(value)) {
		return value;
	}

	value && console.warn(`Unrecognized SEARCH_ENGINE value "${value}"; falling back to auto-detection.`);
	return undefined;
};

/** The image's configuration as the environment sets it, read once, when this module is first imported. */
const configsFromEnv = {
	allowedCorsOrigins: env.ALLOWED_CORS_ORIGINS?.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean),
	catalogueConfigsPath: env.CONFIGS_PATH || './configs',
	// FIXME: this will need Helm chart changes, to inject secrets into env
	catalogs: {
		// these are used as "global" Arranger configs
		fromEnv: {
			// feature flags
			[configFeatureFlagProperties.DISABLE_DOWNLOADS]: stringToBool(env.DISABLE_DOWNLOADS),
			[configFeatureFlagProperties.DISABLE_FILTERS]: stringToBool(env.DISABLE_FILTERS),
			[configFeatureFlagProperties.DISABLE_GRAPHQL_INTROSPECTION]: stringToBool(
				env.DISABLE_GRAPHQL_INTROSPECTION,
				isProd,
			),
			[configFeatureFlagProperties.DISABLE_GRAPHQL_PLAYGROUND]: stringToBool(env.DISABLE_GRAPHQL_PLAYGROUND),
			[configFeatureFlagProperties.ENABLE_GRAPHQL_BATCHING]: stringToBool(env.ENABLE_GRAPHQL_BATCHING),
			[configFeatureFlagProperties.ENABLE_SETS]: stringToBool(env.ENABLE_SETS),

			// catalogue base configs
			// TODO: to be extended as e.g. env[`${catalogId}_ES_HOST`] etc in multicatalogue
			[configRootProperties.DOCUMENT_TYPE]: env.DOCUMENT_TYPE || '',
			[configRootProperties.ES_HOST]: env.ES_HOST || 'http://127.0.0.1:9200',
			[configRootProperties.ES_INDEX]: env.ES_INDEX || '',
			// ES Credentials (should come from env not files)
			[configRootProperties.ES_PASS]: env.ES_PASS || '',
			[configRootProperties.ES_USER]: env.ES_USER || '',
			[configOptionalProperties.SEARCH_ENGINE]: parseSearchEngine(env.SEARCH_ENGINE),

			// graphql security limits
			[configOptionalProperties.GRAPHQL_MAX_ALIASES]: stringToNumber(env.GRAPHQL_MAX_ALIASES),
			[configOptionalProperties.GRAPHQL_MAX_DEPTH]: stringToNumber(env.GRAPHQL_MAX_DEPTH),

			// additional functionality
			[configRootProperties.TABLE]: {
				[tableProperties.MAX_RESULTS_WINDOW]: stringToNumber(
					env.MAX_RESULTS_WINDOW,
					tableDefaults.MAX_RESULTS_WINDOW,
				),
				[tableProperties.ROW_ID_FIELD_NAME]: env.ROW_ID_FIELD_NAME || tableDefaults.ROW_ID_FIELD_NAME,
			},
			[configRootProperties.DOWNLOADS]: {
				[downloadProperties.ALLOW_CUSTOM_MAX_ROWS]: stringToBool(env.ALLOW_CUSTOM_DOWNLOAD_MAX_ROWS),
				[downloadProperties.MAX_ROWS]: stringToNumber(env.DOWNLOAD_MAX_ROWS, 100),
				[downloadProperties.STREAM_BUFFER_SIZE]: stringToNumber(env.DOWNLOAD_STREAM_BUFFER_SIZE, 2000),
			},
			[configRootProperties.SETS]: {
				[setsProperties.INDEX]: env.ES_ARRANGER_SETS_INDEX || 'arranger-sets',
				[setsProperties.TYPE]: env.ES_ARRANGER_SETS_TYPE || 'arranger-sets',
			},
		},
	},
	enableAccessControl: parseEnableAccessControl(env.ENABLE_ACCESS_CONTROL),
	[configFeatureFlagProperties.ENABLE_ADMIN]: stringToBool(env.ENABLE_ADMIN),
	[configFeatureFlagProperties.ENABLE_DEBUG]: stringToBool(env.ENABLE_DEBUG),
	[configFeatureFlagProperties.ENABLE_LOGS]: stringToBool(env.ENABLE_LOGS),
	health: {
		pingMs: stringToNumber(env.PING_MS, 2200),
		pingPath: env.PING_PATH || '/ping',
		readyPath: env.READY_PATH || '/ready',
	},
	serverPort: stringToNumber(env.SERVER_PORT, 5050),
};

export default configsFromEnv;
