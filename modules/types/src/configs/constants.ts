// TODO: reorganize these constants into their actual dependency tree

// generic terms
const DOCUMENT_TYPE = 'documentType';
const INSTANCE_ID = 'instanceID';
const INDEX = 'index';
const TYPE = 'type';

// Root level properties
export const configFeatureFlagProperties = {
	DISABLE_FILTERS: 'disableFilters',
	DISABLE_GRAPHQL_PLAYGROUND: 'disablePlayground',
	ENABLE_ADMIN: 'enableAdmin',
	ENABLE_DEBUG: 'enableDebug',
	ENABLE_LOGS: 'enableLogs',
	ENABLE_NETWORK_AGGREGATION: 'enableNetworkAggregation',
	ENABLE_SETS: 'enableSets', // TODO: not implemented yet
} as const;

export const configOptionalProperties = {
	...configFeatureFlagProperties,
	CHARTS: 'charts',
	DOWNLOADS: 'downloads',
	EXTENDED: 'extended',
	FACETS: 'facets',
	INSTANCE_ID,
	MATCHBOX: 'matchbox',
	NETWORK_AGGREGATION: 'network',
	SETS: 'sets',
	TABLE: 'table',
} as const;

export const configRequiredProperties = {
	DOCUMENT_TYPE,
	INDEX,
	ES_HOST: 'esHost',
	ES_PASS: 'esPass',
	ES_USER: 'esUser',
} as const;

export const configRootProperties = {
	...configOptionalProperties,
	...configRequiredProperties,
};

// Components' and nested properties
export const dataFieldProperties = {
	ACCESSOR: 'accessor',
	CAN_CHANGE_SHOW: 'canChangeShow',
	DISPLAY_FORMAT: 'displayFormat',
	DISPLAY_NAME: 'displayName',
	DISPLAY_TYPE: 'displayType',
	DISPLAY_VALUES: 'displayValues',
	FIELD_NAME: 'fieldName',
	IS_ACTIVE: 'isActive',
	IS_ARRAY: 'isArray',
	JSON_PATH: 'jsonPath',
	PRIMARY_KEY: 'primaryKey',
	QUERY: 'query',
	QUICKSEARCH_ENABLED: 'quickSearchEnabled',
	RANGE_STEP: 'rangeStep',
	SHOW: 'show',
	SORTABLE: 'sortable',
	TYPE,
	UNIT: 'unit',
} as const;

export const downloadProperties = {
	ALLOW_CUSTOM_MAX_DOWNLOAD_ROWS: 'allowCustomMaxRows',
	DOWNLOAD_STREAM_BUFFER_SIZE: 'chunkSize',
	MAX_DOWNLOAD_ROWS: 'maxRows',
} as const;

export const facetsProperties = {
	AGGS: 'aggregations',
} as const;

export const setsProperties = {
	INDEX,
	TYPE,
} as const;

export const sortingProperties = {
	DEFAULT_SORTING: 'defaultSorting',
	DESCENDING: 'desc',
} as const;

export const tableProperties = {
	COLUMNS: 'columns',
	DEFAULT_SORTING: sortingProperties.DEFAULT_SORTING,
	DESCENDING: sortingProperties.DESCENDING,
	MAX_RESULTS_WINDOW: 'maxResultsWindow',
	ROW_ID_FIELD_NAME: 'rowIdFieldName',
} as const;

// Federated setup properties
export const networkAggregationProperties = {
	GRAPHQL_URL: 'graphqlUrl',
	DOCUMENT_TYPE,
	DISPLAY_NAME: 'displayName',
} as const;

// Charts Visualization Library
export const chartsProperties = {
	QUERY: 'query',
} as const;

//////////////////////////////////

/**
 * Mixed bag for easy use by external implementers.
 * Avoid whenever possible.
 */
export const allConfigProperties = {
	...dataFieldProperties,
	...downloadProperties,
	...facetsProperties,
	...configOptionalProperties,
	...configRequiredProperties,
	...setsProperties,
	...tableProperties,
};
