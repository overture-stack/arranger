// TODO: will gradually tighten these as we migrate to TS

import { ES_TYPES } from '@/mapping/esToAggTypeMap';

export enum ConfigOptionalProperties {
	DOWNLOADS = 'downloads',
}

export enum ConfigRequiredProperties {
	DOCUMENT_TYPE = 'documentType',
	EXTENDED = 'extended',
	FACETS = 'facets',
	INDEX = 'index',
	MATCHBOX = 'matchbox',
	TABLE = 'table',
}

export enum DataFieldProperties {
	ACCESSOR = 'accessor',
	CAN_CHANGE_SHOW = 'canChangeShow',
	DISPLAY_FORMAT = 'displayFormat',
	DISPLAY_NAME = 'displayName',
	DISPLAY_TYPE = 'displayType',
	DISPLAY_VALUES = 'displayValues',
	IS_ACTIVE = 'isActive',
	IS_ARRAY = 'isArray',
	JSON_PATH = 'jsonPath',
	FIELD_NAME = 'fieldName',
	PRIMARY_KEY = 'primaryKey',
	QUERY = 'query',
	QUICKSEARCH_ENABLED = 'quickSearchEnabled',
	RANGE_STEP = 'rangeStep',
	SHOW = 'show',
	SORTABLE = 'sortable',
	TYPE = 'type',
	UNIT = 'unit',
}

export enum DownloadProperties {
	ALLOW_CUSTOM_MAX_DOWNLOAD_ROWS = 'allowCustomMaxRows',
	MAX_DOWNLOAD_ROWS = 'maxRows',
}

export enum FacetsProperties {
	AGGS = 'aggregations',
}

export enum TableProperties {
	COLUMNS = 'columns',
	DESCENDING = 'desc',
	DEFAULT_SORTING = 'defaultSorting',
	KEY_FIELD_NAME = 'keyFieldName',
	MAX_RESULTS_WINDOW = 'maxResultsWindow',
}

//////////////////////////////////

export const ConfigProperties = {
	...ConfigRequiredProperties,
	...ConfigOptionalProperties,
	...DataFieldProperties,
	...DownloadProperties,
	...FacetsProperties,
	...TableProperties,
};

export type ConfigProperties = ConfigRequiredProperties | ConfigOptionalProperties;

export interface AggConfigsInterface {
	[ConfigProperties.DISPLAY_TYPE]: string;
	[ConfigProperties.FIELD_NAME]: string;
	[ConfigProperties.IS_ACTIVE]: boolean;
	[ConfigProperties.SHOW]: boolean;
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

export type DisplayType = 'all' | 'bits' | 'boolean' | 'bytes' | 'date' | 'list' | 'number';

export interface ExtendedConfigsInterface {
	[ConfigProperties.DISPLAY_NAME]: string;
	[ConfigProperties.DISPLAY_TYPE]: string;
	[ConfigProperties.DISPLAY_VALUES]: Record<string, any>;
	[ConfigProperties.FIELD_NAME]: string;
	[ConfigProperties.IS_ACTIVE]: boolean;
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
	[ConfigProperties.KEY_FIELD_NAME]?: string;
	[ConfigProperties.MAX_RESULTS_WINDOW]?: number;
}

export interface ConfigObject {
	[ConfigProperties.DOCUMENT_TYPE]: string;
	[ConfigProperties.DOWNLOADS]?: DownloadsConfigsInterface;
	[ConfigProperties.EXTENDED]: any[];
	[ConfigProperties.FACETS]: FacetsConfigsInterface;
	[ConfigProperties.INDEX]: string;
	[ConfigProperties.MATCHBOX]: any[];
	[ConfigProperties.TABLE]: TableConfigsInterface;
}

export interface FieldFromMapping {
	fieldName: string;
	type: ES_TYPES;
}
