export enum ConfigProperties {
  AGGS = 'aggs-state',
  COLUMNS = 'columns-state',
  EXTENDED = 'extended',
  GRAPHQL_FIELD = 'name',
  INDEX = 'index',
  MATCHBOX = 'matchbox-state',
}

// This type is WIP
export type ConfigObject = Record<ConfigProperties, any>;
