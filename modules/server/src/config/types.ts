export enum ConfigRequiredProperties {
  AGGS = 'aggs-state',
  COLUMNS = 'columns-state',
  EXTENDED = 'extended',
  DOCUMENT_TYPE = 'document-type',
  INDEX = 'index',
  MATCHBOX = 'matchbox-state',
}

export enum ConfigOptionalProperties {
  ALLOW_CUSTOM_DOWNLOAD_MAX_ROWS = 'allow-custom-download-max-rows',
  DOWNLOAD_MAX_ROWS = 'download-max-rows',
}

export const ConfigProperties = { ...ConfigRequiredProperties, ...ConfigOptionalProperties };
export type ConfigProperties = ConfigRequiredProperties | ConfigOptionalProperties;

export type ConfigObject = Record<ConfigProperties, any>;
