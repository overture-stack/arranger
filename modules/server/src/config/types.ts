// TODO: will gradually tighten these as we migrate to TS

import { type ES_TYPES } from '#mapping/esToAggTypeMap.js';

export const ConfigOptionalProperties = {
	DOWNLOADS: 'downloads',
	MATCHBOX: 'matchbox',
	NETWORK_AGGREGATION: 'network',
} as const;

export const ConfigRequiredProperties = {
	DOCUMENT_TYPE: 'documentType',
	EXTENDED: 'extended',
	FACETS: 'facets',
	INDEX: 'index',
	TABLE: 'table',
	CHARTS: 'charts',
} as const;

export const DataFieldProperties = {
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

export const DownloadProperties = {
	ALLOW_CUSTOM_MAX_DOWNLOAD_ROWS: 'allowCustomMaxRows',
	MAX_DOWNLOAD_ROWS: 'maxRows',
} as const;

export const FacetsProperties = {
	AGGS: 'aggregations',
} as const;

export const TableProperties = {
	COLUMNS: 'columns',
	DESCENDING: 'desc',
	DEFAULT_SORTING: 'defaultSorting',
	MAX_RESULTS_WINDOW: 'maxResultsWindow',
	ROW_ID_FIELD_NAME: 'rowIdFieldName',
} as const;

const NetworkAggregationProperties = {
	GRAPHQL_URL: 'graphqlUrl',
	DOCUMENT_TYPE: 'documentType',
	DISPLAY_NAME: 'displayName',
} as const;

//////////////////////////////////

export const ConfigProperties = {
	...ConfigRequiredProperties,
	...ConfigOptionalProperties,
	...DataFieldProperties,
	...DownloadProperties,
	...FacetsProperties,
	...TableProperties,
};

export type ConfigProperties = typeof ConfigRequiredProperties | typeof ConfigOptionalProperties;

export interface AggConfigsInterface {
	[ConfigProperties.DISPLAY_NAME]: string;
	[ConfigProperties.DISPLAY_TYPE]: string;
	[ConfigProperties.FIELD_NAME]: string;
	[ConfigProperties.IS_ACTIVE]: boolean; // TODO: what is this? active = API vs show = UI? "isActive"
	[ConfigProperties.SHOW]: boolean;
	// TODO: implement these
	// max results
	// collapsible
}

export interface ColumnConfigsInterface {
	[ConfigProperties.ACCESSOR]: string;
	[ConfigProperties.CAN_CHANGE_SHOW]: boolean;
	[ConfigProperties.DISPLAY_FORMAT]: string;
	[ConfigProperties.DISPLAY_NAME]: string;
	[ConfigProperties.DISPLAY_TYPE]: string;
	[ConfigProperties.DISPLAY_VALUES]: Record<string, any>; // used for "readable" replacements e.g. true as "yes"
	[ConfigProperties.FIELD_NAME]: string;
	[ConfigProperties.IS_ARRAY]: boolean; // should it be displayed as a list of items, or leave as a single string
	[ConfigProperties.JSON_PATH]: string;
	[ConfigProperties.QUERY]: string;
	[ConfigProperties.SHOW]: boolean;
	[ConfigProperties.SORTABLE]: boolean;
}

export interface DownloadsConfigsInterface {
	[ConfigProperties.ALLOW_CUSTOM_MAX_DOWNLOAD_ROWS]?: boolean;
	[ConfigProperties.MAX_DOWNLOAD_ROWS]?: number;
}

export type DisplayType = 'all' | 'bits' | 'boolean' | 'bytes' | 'date' | 'list' | 'nested' | 'number';

export interface ExtendedConfigsInterface {
	[ConfigProperties.DISPLAY_NAME]: string;
	[ConfigProperties.DISPLAY_TYPE]: string;
	[ConfigProperties.DISPLAY_VALUES]: Record<string, any>;
	[ConfigProperties.FIELD_NAME]: string;
	[ConfigProperties.IS_ACTIVE]: boolean; // TODO: what is this?
	[ConfigProperties.IS_ARRAY]: boolean;
	[ConfigProperties.PRIMARY_KEY]: boolean;
	[ConfigProperties.QUICKSEARCH_ENABLED]: boolean;
	[ConfigProperties.RANGE_STEP]: number;
	[ConfigProperties.TYPE]: DisplayType;
	[ConfigProperties.UNIT]: string;
}

export interface FacetsConfigsInterface {
	[ConfigProperties.AGGS]: AggConfigsInterface[];
}

export interface MatchBoxConfigsInterface {
	[ConfigProperties.DISPLAY_NAME]: string;
	[ConfigProperties.FIELD_NAME]: string;
}

export interface SortingConfigsInterface {
	[ConfigProperties.DESCENDING]: boolean;
	[ConfigProperties.FIELD_NAME]: string;
	[ConfigProperties.IS_ACTIVE]: boolean;
}

export interface TableConfigsInterface {
	[ConfigProperties.COLUMNS]: ColumnConfigsInterface[];
	[ConfigProperties.DEFAULT_SORTING]?: SortingConfigsInterface[];
	[ConfigProperties.MAX_RESULTS_WINDOW]?: number;
	[ConfigProperties.ROW_ID_FIELD_NAME]?: string;
}

interface NetworkAggregationInterface {
	[NetworkAggregationProperties.GRAPHQL_URL]: string;
	[NetworkAggregationProperties.DOCUMENT_TYPE]: string;
	[NetworkAggregationProperties.DISPLAY_NAME]: string;
}
[];

export interface ConfigObject {
	[ConfigProperties.DOCUMENT_TYPE]: string;
	[ConfigProperties.DOWNLOADS]?: DownloadsConfigsInterface;
	[ConfigProperties.EXTENDED]: any[];
	[ConfigProperties.FACETS]: FacetsConfigsInterface;
	[ConfigProperties.INDEX]: string;
	[ConfigProperties.MATCHBOX]: any[];
	[ConfigProperties.TABLE]: TableConfigsInterface;
	[ConfigProperties.NETWORK_AGGREGATION]: any[];
}

export interface FieldFromMapping {
	fieldName: string;
	type: ES_TYPES;
}
