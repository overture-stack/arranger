// individual values
const DOWNLOAD_STREAM_BUFFER_SIZE = 2000;
const ES_ARRANGER_SET_INDEX = 'arranger-sets';
const ES_HOST = 'http://127.0.0.1:9200';
const ES_PASS = 'unsafePassword123';
const ES_USER = 'elastic';

// fallback configs for module start and testing
const fallbackConfigs = {
	enableAdmin: false,
	enableDebug: false,
	enableLogs: false,
	enableNetworkAggregation: false,

	esHost: ES_HOST,
	esPass: ES_PASS,
	esUser: ES_USER,

	sets: {
		index: ES_ARRANGER_SET_INDEX,
		type: ES_ARRANGER_SET_INDEX,
	},

	downloads: {
		chunkSize: DOWNLOAD_STREAM_BUFFER_SIZE,
	},
} as const;

export default fallbackConfigs;
