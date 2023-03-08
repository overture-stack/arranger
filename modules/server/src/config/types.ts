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
	FIELD_NAME = 'fieldName',
	KEY_FIELD_NAME = 'keyFieldName',
	MAX_RESULTS_WINDOW = 'maxResultsWindow',
}

//////////////////////////////////

export const ConfigProperties = {
	...ConfigRequiredProperties,
	...ConfigOptionalProperties,
	...DownloadProperties,
	...FacetsProperties,
	...TableProperties,
};

export type ConfigProperties = ConfigRequiredProperties | ConfigOptionalProperties;

export interface SortingInterface {
	[ConfigProperties.DESCENDING]: boolean;
	[ConfigProperties.FIELD_NAME]: string;
}

// TODO: will tighten these later with a TS migration
export interface ConfigObject {
	[ConfigProperties.DOCUMENT_TYPE]: string;
	[ConfigProperties.DOWNLOADS]?: {
		[ConfigProperties.ALLOW_CUSTOM_MAX_DOWNLOAD_ROWS]?: boolean;
		[ConfigProperties.MAX_DOWNLOAD_ROWS]?: number;
	};
	[ConfigProperties.EXTENDED]: any[];
	[ConfigProperties.FACETS]: {
		[ConfigProperties.AGGS]: any[];
	};
	[ConfigProperties.INDEX]: string;
	[ConfigProperties.MATCHBOX]: any[];
	[ConfigProperties.TABLE]: {
		[ConfigProperties.COLUMNS]: any[];
		[ConfigProperties.DEFAULT_SORTING]?: SortingInterface[];
		[ConfigProperties.KEY_FIELD_NAME]?: string;
		[ConfigProperties.MAX_RESULTS_WINDOW]?: number;
	};
}
