export enum ConfigProperties {
  AGGS = 'aggs-state',
  COLUMNS = 'columns-state',
  EXTENDED = 'extended',
  GRAPHQL_FIELD = 'name',
  INDEX = 'index',
  MATCHBOX = 'matchbox-state',

  /****************************************************************
   *                    OPTIONAL BASE CONFIGS
   ***************************************************************/
  // ALLOW_CUSTOM_DOWNLOAD_MAX_ROWS = 'allowCustomDownloadMaxRows',
  // DOWNLOAD_MAX_ROWS = 'downloadMaxRows',
}

// This type is WIP
export type ConfigObject = Record<ConfigProperties, any>;
