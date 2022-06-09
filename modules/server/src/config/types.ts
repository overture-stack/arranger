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
  };
}
