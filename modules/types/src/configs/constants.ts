// TODO: reorganize these constants into their actual dependency tree: server vs catalogue, nested properly, etc.

// generic terms
const CATALOG_ID = 'catalogId';
const DOCUMENT_TYPE = 'documentType';
const TYPE = 'type';

// Root level properties

export const configArrangerFeatureFlagProperties = {
	DISABLE_DOWNLOADS: 'disableDownloads',
	DISABLE_FILTERS: 'disableFilters',
	DISABLE_GRAPHQL_INTROSPECTION: 'disableGraphQLIntrospection',
	DISABLE_GRAPHQL_PLAYGROUND: 'disablePlayground',
	ENABLE_SETS: 'enableSets',
} as const;

export const configRuntimeFeatureFlagProperties = {
	ENABLE_ADMIN: 'enableAdmin', // FIXME: must be removed, untangle the facets agg vs numericAggs
	ENABLE_DEBUG: 'enableDebug',
	ENABLE_LOGS: 'enableLogs',
} as const;

export const configFeatureFlagProperties = {
	...configArrangerFeatureFlagProperties,
	...configRuntimeFeatureFlagProperties,
};

export const featureFlagDefaults = Object.values(configFeatureFlagProperties).reduce(
	(acc, flag) => ({
		...acc,
		[flag]: false,
	}),
	{},
);

export const configOptionalProperties = {
	CATALOG_ID,
	DESCRIPTION: 'description',
	ES_HOST: 'esHost',
	DOWNLOADS: 'downloads',
	EXTENDED: 'extended',
	GRAPHQL_MAX_ALIASES: 'maxAliases',
	GRAPHQL_MAX_DEPTH: 'maxDepth',
	SEARCH_ENGINE: 'searchEngine',
	SETS: 'sets',
	...configFeatureFlagProperties,
	//
	// configs for dependent libraries
	CHARTS: 'charts',
	FACETS: 'facets',
	MATCHBOX: 'matchbox',
	NETWORK_AGGREGATION: 'network',
	TABLE: 'table',
} as const;

export const configArrangerBaseProperties = {
	DOCUMENT_TYPE,
	ES_INDEX: 'esIndex',
} as const;

export const configArrangerNetworkProperties = {
	CUSTOMIZE_REMOTE_REQUEST: 'customizeRemoteRequest',
	REMOTE_NODES: 'remoteNodes',
	LOCAL_NODE: 'localNode',
} as const;

export const configRequiredProperties = {
	...configArrangerBaseProperties,
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
	ALLOW_CUSTOM_MAX_ROWS: 'allowCustomMaxRows',
	MAX_ROWS: 'maxRows',
	STREAM_BUFFER_SIZE: 'chunkSize',
} as const;

export const setsProperties = {
	INDEX: 'index',
	TYPE,
} as const;

export const facetsProperties = {
	AGGS: 'aggregations',
} as const;

export const baseNodeProperties = {
	DISPLAY_NAME: 'displayName',
	NODE_ID: 'nodeId',
} as const;
export const localNodeProperties = {
	CATALOG_ID,
} as const;

export const remoteNodeProperties = {
	GRAPHQL_URL: 'graphqlUrl',
	DOCUMENT_TYPE,
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

export const tableDefaults = {
	MAX_RESULTS_WINDOW: 10000,
	ROW_ID_FIELD_NAME: 'id',
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
