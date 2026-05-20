import { featureFlagDefaults, setsProperties } from '@overture-stack/arranger-types/configs';
import {
	chartsProperties,
	configRootProperties,
	downloadProperties,
	facetsProperties,
	tableProperties,
} from '@overture-stack/arranger-types/configs/constants';

// individual values
const DOWNLOAD_MAX_ROWS = 100 as const;
const DOWNLOAD_STREAM_BUFFER_SIZE = 2000 as const;
const ES_ARRANGER_SETS = 'arranger-sets' as const;
const MAX_RESULTS_WINDOW = 10000 as const;
const ROW_ID_FIELD_NAME = 'id' as const;
const SEARCH_ENGINE = 'elasticsearch' as const;

// fallback configs for module start and testing
const fallbackCatalogConfigs = {
	...featureFlagDefaults,
	[configRootProperties.SEARCH_ENGINE]: SEARCH_ENGINE,
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
	[configRootProperties.TABLE]: {
		[tableProperties.COLUMNS]: [],
		[tableProperties.MAX_RESULTS_WINDOW]: MAX_RESULTS_WINDOW,
		[tableProperties.ROW_ID_FIELD_NAME]: ROW_ID_FIELD_NAME,
	},
};

export default fallbackCatalogConfigs;
