import {
	configFeatureFlagProperties,
	configOptionalProperties,
	configRootProperties,
	downloadProperties,
	setsProperties,
} from '@overture-stack/arranger-types/configs/constants';
import { stringToArray, stringToBool, stringToNumber } from '@overture-stack/arranger-types/tools';

const configsFromEnv = {
	allowedCorsOrigins: process.env.ALLOWED_CORS_ORIGINS?.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean),
	catalogConfigsPath: process.env.CONFIGS_PATH || './configs',
	// FIXME: this will need Helm chart changes, to inject secrets into config files
	catalogs: {
		// these are used as "global" Arranger configs
		fromEnv: {
			// feature flags
			[configFeatureFlagProperties.DISABLE_DOWNLOADS]: stringToBool(process.env.DISABLE_DOWNLOADS),
			[configFeatureFlagProperties.DISABLE_FILTERS]: stringToBool(process.env.DISABLE_FILTERS),
			[configFeatureFlagProperties.DISABLE_GRAPHQL_PLAYGROUND]: stringToBool(
				process.env.DISABLE_GRAPHQL_PLAYGROUND,
			),
			[configFeatureFlagProperties.DISABLE_SETS]: stringToBool(process.env.DISABLE_SETS),

			// catalog base configs
			// TODO: to be extended as e.g. process.env[`${catalogId}_ES_HOST`] etc in multicatalog
			[configRootProperties.ES_HOST]: process.env.ES_HOST || 'http://127.0.0.1:9200',
			[configRootProperties.ES_INDEX]: process.env.ES_INDEX || '',
			// ES Credentials (should come from env not files)
			[configRootProperties.ES_PASS]: process.env.ES_PASS || '',
			[configRootProperties.ES_USER]: process.env.ES_USER || '',

			// graphql security limits
			[configOptionalProperties.GRAPHQL_MAX_ALIASES]: stringToNumber(process.env.GRAPHQL_MAX_ALIASES),
			[configOptionalProperties.GRAPHQL_MAX_DEPTH]: stringToNumber(process.env.GRAPHQL_MAX_DEPTH),

			// additional functionality
			[configRootProperties.DOWNLOADS]: {
				[downloadProperties.ALLOW_CUSTOM_MAX_ROWS]: stringToBool(process.env.ALLOW_CUSTOM_DOWNLOAD_MAX_ROWS),
				[downloadProperties.MAX_ROWS]: stringToNumber(process.env.DOWNLOAD_MAX_ROWS, 100),
				[downloadProperties.STREAM_BUFFER_SIZE]: stringToNumber(process.env.DOWNLOAD_STREAM_BUFFER_SIZE, 100),
			},
			[configRootProperties.SETS]: {
				[setsProperties.INDEX]: process.env.ES_ARRANGER_SETS_INDEX || 'arranger-sets',
				[setsProperties.TYPE]: process.env.ES_ARRANGER_SETS_TYPE || 'arranger-sets',
			},
		},
	},
	[configFeatureFlagProperties.ENABLE_ADMIN]: stringToBool(process.env.ENABLE_ADMIN),
	[configFeatureFlagProperties.ENABLE_DEBUG]: stringToBool(process.env.ENABLE_DEBUG),
	[configFeatureFlagProperties.ENABLE_LOGS]: stringToBool(process.env.ENABLE_LOGS),
	health: {
		pingMs: stringToNumber(process.env.PING_MS) || 2200,
		pingPath: process.env.PING_PATH || '/ping',
	},
	serverPort: stringToNumber(process.env.SERVER_PORT) || 5050,
};

export default configsFromEnv;
