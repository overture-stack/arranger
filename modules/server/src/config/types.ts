// TODO: will gradually tighten these as we migrate to TS

import { type ES_TYPES } from '#mapping/esToAggTypeMap.js';

export const chartsProperties = {
	QUERY: 'query',
} as const;

export const configOptionalProperties = {
	CHARTS: 'charts',
	DOWNLOADS: 'downloads',
	MATCHBOX: 'matchbox',
	NETWORK_AGGREGATION: 'network',
} as const;

export const configRequiredProperties = {
	DOCUMENT_TYPE: 'documentType',
	EXTENDED: 'extended',
	FACETS: 'facets',
	INDEX: 'index',
	TABLE: 'table',
} as const;

export const dataFieldProperties = {
	ACCESSOR: 'accessor',
	CAN_CHANGE_SHOW: 'canChangeShow',
	DISPLAY_FORMAT: 'displayFormat',
	DISPLAY_NAME: 'displayName',
	DISPLAY_TYPE: 'displayType',
	DISPLAY_VALUES: 'displayValues',
	IS_ACTIVE: 'isActive',
	IS_ARRAY: 'isArray',
	JSON_PATH: 'jsonPath',
	FIELD_NAME: 'fieldName',
	PRIMARY_KEY: 'primaryKey',
	QUERY: 'query',
	QUICKSEARCH_ENABLED: 'quickSearchEnabled',
	RANGE_STEP: 'rangeStep',
	SHOW: 'show',
	SORTABLE: 'sortable',
	TYPE: 'type',
	UNIT: 'unit',
} as const;

export const downloadProperties = {
	ALLOW_CUSTOM_MAX_DOWNLOAD_ROWS: 'allowCustomMaxRows',
	MAX_DOWNLOAD_ROWS: 'maxRows',
} as const;

export const facetsProperties = {
	AGGS: 'aggregations',
} as const;

export const tableProperties = {
	COLUMNS: 'columns',
	DESCENDING: 'desc',
	DEFAULT_SORTING: 'defaultSorting',
	MAX_RESULTS_WINDOW: 'maxResultsWindow',
	ROW_ID_FIELD_NAME: 'rowIdFieldName',
} as const;

const networkAggregationProperties = {
	GRAPHQL_URL: 'graphqlUrl',
	DOCUMENT_TYPE: 'documentType',
	DISPLAY_NAME: 'displayName',
} as const;

//////////////////////////////////

export const configProperties = {
	...configRequiredProperties,
	...configOptionalProperties,
	...dataFieldProperties,
	...downloadProperties,
	...facetsProperties,
	...tableProperties,
};

export type ConfigProperties = typeof configRequiredProperties | typeof configOptionalProperties;

export type AggConfigs = {
	[configProperties.DISPLAY_NAME]: string;
	[configProperties.DISPLAY_TYPE]: string;
	[configProperties.FIELD_NAME]: string;
	[configProperties.IS_ACTIVE]: boolean; // TODO: what is this? active = API vs show = UI? "isActive"
	[configProperties.SHOW]: boolean;
	// TODO: implement these
	// max results
	// collapsible
};

export type ChartConfigs = {
	[chartsProperties.QUERY]: string;
};

export type ColumnConfigs = {
	[configProperties.ACCESSOR]: string;
	[configProperties.CAN_CHANGE_SHOW]: boolean;
	[configProperties.DISPLAY_FORMAT]: string;
	[configProperties.DISPLAY_NAME]: string;
	[configProperties.DISPLAY_TYPE]: string;
	[configProperties.DISPLAY_VALUES]: Record<string, any>; // used for "readable" replacements e.g. true as "yes"
	[configProperties.FIELD_NAME]: string;
	[configProperties.IS_ARRAY]: boolean; // should it be displayed as a list of items, or leave as a single string
	[configProperties.JSON_PATH]: string;
	[configProperties.QUERY]: string;
	[configProperties.SHOW]: boolean;
	[configProperties.SORTABLE]: boolean;
};

export type DownloadsConfigs = {
	[configProperties.ALLOW_CUSTOM_MAX_DOWNLOAD_ROWS]?: boolean;
	[configProperties.MAX_DOWNLOAD_ROWS]?: number;
};

export type DisplayType = 'all' | 'bits' | 'boolean' | 'bytes' | 'date' | 'list' | 'nested' | 'number';

export type ExtendedConfigs = {
	[configProperties.DISPLAY_NAME]: string;
	[configProperties.DISPLAY_TYPE]: string;
	[configProperties.DISPLAY_VALUES]: Record<string, any>;
	[configProperties.FIELD_NAME]: string;
	[configProperties.IS_ACTIVE]: boolean; // TODO: what is this?
	[configProperties.IS_ARRAY]: boolean;
	[configProperties.PRIMARY_KEY]: boolean;
	[configProperties.QUICKSEARCH_ENABLED]: boolean;
	[configProperties.RANGE_STEP]: number;
	[configProperties.TYPE]: DisplayType;
	[configProperties.UNIT]: string;
};

export type FacetsConfigs = {
	[configProperties.AGGS]: AggConfigs[];
};

export type MatchBoxConfigs = {
	[configProperties.DISPLAY_NAME]: string;
	[configProperties.FIELD_NAME]: string;
};

export type SortingConfigs = {
	[configProperties.DESCENDING]: boolean;
	[configProperties.FIELD_NAME]: string;
	[configProperties.IS_ACTIVE]: boolean;
};

export type TableConfigs = {
	[configProperties.COLUMNS]: ColumnConfigs[];
	[configProperties.DEFAULT_SORTING]?: SortingConfigs[];
	[configProperties.MAX_RESULTS_WINDOW]?: number;
	[configProperties.ROW_ID_FIELD_NAME]?: string;
};

export type NetworkAggregation = {
	[networkAggregationProperties.GRAPHQL_URL]: string;
	[networkAggregationProperties.DOCUMENT_TYPE]: string;
	[networkAggregationProperties.DISPLAY_NAME]: string;
};

export type ConfigObject = {
	[configProperties.CHARTS]: ChartConfigs;
	[configProperties.DOCUMENT_TYPE]: string;
	[configProperties.DOWNLOADS]?: DownloadsConfigs;
	[configProperties.EXTENDED]: any[];
	[configProperties.FACETS]: FacetsConfigs;
	[configProperties.INDEX]: string;
	[configProperties.MATCHBOX]: any[];
	[configProperties.TABLE]: TableConfigs;
	[configProperties.NETWORK_AGGREGATION]: NetworkAggregation[];
};

export type FieldFromMapping = {
	fieldName: string;
	type: ES_TYPES;
};
