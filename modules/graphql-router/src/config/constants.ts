import {
	configArrangerNetworkProperties,
	featureFlagDefaults,
	setsProperties,
} from '@overture-stack/arranger-types/configs';
import {
	chartsProperties,
	downloadProperties,
	facetsProperties,
	configRootProperties,
	tableProperties,
} from '@overture-stack/arranger-types/configs/constants';

// individual values
const DOWNLOAD_MAX_ROWS = 100;
const DOWNLOAD_STREAM_BUFFER_SIZE = 2000;
const ES_ARRANGER_SETS = 'arranger-sets';
const MAX_RESULTS_WINDOW = 10000;
const ROW_ID_FIELD_NAME = 'id';

// fallback configs for module start and testing
const fallbackCatalogConfigs = {
	...featureFlagDefaults,
	[configRootProperties.DOWNLOADS]: {
		[downloadProperties.ALLOW_CUSTOM_MAX_ROWS]: false,
		[downloadProperties.MAX_ROWS]: DOWNLOAD_MAX_ROWS,
		[downloadProperties.STREAM_BUFFER_SIZE]: DOWNLOAD_STREAM_BUFFER_SIZE,
	},
	[configRootProperties.EXTENDED]: [],
	[configRootProperties.SETS]: {
		[setsProperties.INDEX]: ES_ARRANGER_SETS,
		[setsProperties.TYPE]: ES_ARRANGER_SETS,
	},
	// dependent libraries
	[configRootProperties.CHARTS]: {
		[chartsProperties.QUERY]: '', // FIXME: is this supposed to be an array?
	},
	[configRootProperties.FACETS]: {
		[facetsProperties.AGGS]: [],
	},
	[configRootProperties.MATCHBOX]: [],
	[configRootProperties.NETWORK_AGGREGATION]: { [configArrangerNetworkProperties.REMOTE_NODES]: [] },
	[configRootProperties.TABLE]: {
		[tableProperties.COLUMNS]: [],
		[tableProperties.MAX_RESULTS_WINDOW]: MAX_RESULTS_WINDOW,
		[tableProperties.ROW_ID_FIELD_NAME]: ROW_ID_FIELD_NAME,
	},
};

export default fallbackCatalogConfigs;
