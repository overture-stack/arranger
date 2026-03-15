import {
	rootConfigProperties,
	downloadProperties,
	facetsProperties,
	setsProperties,
	tableProperties,
} from '@overture-stack/arranger-types/configs/constants';
import { stringToArray, stringToBool, stringToNumber } from '@overture-stack/arranger-types/tools';

const configsFromEnv = {
	// server settings
	configsSource: process.env.CONFIG_PATH || './configs',
	enableDebug: stringToBool(process.env.ENABLE_DEBUG),
	enableLogs: stringToBool(process.env.ENABLE_LOGS),
	enableNetworkAggregation: stringToBool(process.env.ENABLE_NETWORK_AGGREGATION),
	pingMs: stringToNumber(process.env.PING_MS) || 2200,
	pingPath: process.env.PING_PATH || '/ping',
	port: stringToNumber(process.env.PORT) || 5050,

	// -------------------------------------------
	// "Networking aggregations" comes from Arranger
	// which means the server may optionally need
	// a separate base instance for that purpose
	// with (or without) "local" search of its own
	// TODO: relocate these here
	// [arrangerConfigProperties.NETWORK_AGGREGATION]: stringToArray(process.env.NETWORK_AGGREGATIONS),

	// Arranger-specific search configs
	// multi-catalog should "append" to these
	catalogs: {
		fromEnv: {
			// base configs
			[rootConfigProperties.DOCUMENT_TYPE]: process.env.DOCUMENT_TYPE || '',
			[rootConfigProperties.INDEX]: process.env.ES_INDEX || '',

			[rootConfigProperties.ES_HOST]: process.env.ES_HOST || '',
			[rootConfigProperties.ES_PASS]: process.env.ES_PASS || '',
			[rootConfigProperties.ES_USER]: process.env.ES_USER || '',

			[rootConfigProperties.DISABLE_GRAPHQL_PLAYGROUND]: stringToBool(process.env.DISABLE_GRAPHQL_PLAYGROUND),
			[rootConfigProperties.DISABLE_FILTERS]: stringToBool(process.env.DISABLE_FILTERS),
			[rootConfigProperties.ENABLE_ADMIN]: stringToBool(process.env.ENABLE_ADMIN),
			[rootConfigProperties.ENABLE_DEBUG]: stringToBool(process.env.ENABLE_DEBUG),
			[rootConfigProperties.ENABLE_LOGS]: stringToBool(process.env.ENABLE_LOGS),

			[rootConfigProperties.DOWNLOADS]: {
				[downloadProperties.ALLOW_CUSTOM_MAX_DOWNLOAD_ROWS]: stringToBool(
					process.env.ALLOW_CUSTOM_MAX_DOWNLOAD_ROWS,
				),
				[downloadProperties.MAX_DOWNLOAD_ROWS]: stringToNumber(process.env.MAX_DOWNLOAD_ROWS, 100),
			},
			[rootConfigProperties.SETS]: {
				[setsProperties.INDEX]: process.env.ES_ARRANGER_SET_INDEX || 'arranger-sets',
				[setsProperties.TYPE]: process.env.ES_ARRANGER_SET_INDEX || 'arranger-sets',
			},
			// components
			[rootConfigProperties.FACETS]: {
				[facetsProperties.AGGS]: [],
			},
			[rootConfigProperties.MATCHBOX]: [],
			[rootConfigProperties.TABLE]: {
				[tableProperties.COLUMNS]: [],
				[tableProperties.MAX_RESULTS_WINDOW]: stringToNumber(process.env.MAX_RESULTS_WINDOW, 10000),
				[tableProperties.ROW_ID_FIELD_NAME]: process.env.ROW_ID_FIELD_NAME || 'id',
			},

			// TODO: WIP - analyze and refine this config.
			[rootConfigProperties.NETWORK_AGGREGATION]: stringToArray(process.env.NETWORK_AGGREGATIONS),
		},
	},
};

export default configsFromEnv;
