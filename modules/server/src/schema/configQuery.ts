// TODO1: Add "descriptions" for the fields. Could use the comments in '#mapping/extendMapping'
// TODO2: these "as const" can be removed with TS v5

const FacetsConfigTypeDefs = `
  type AggregationMapping {
    displayName: String
    displayType: String
    fieldName: String
    isActive: Boolean
    show: Boolean
    type: String
      @deprecated(
        reason: "This field is deprecated in favour of displayType. Projects created with v0.4.6 will return null for this query"
      )
  }

  type FacetsConfig {
    aggregations: [AggregationMapping]
  }
`;

const TableConfigTypeDefs = `
  type ColumnMapping {
    accessor: String
    canChangeShow: Boolean
    displayFormat: String
    displayName: String
    displayType: String
    displayValues: JSON
    fieldName: String
    id: String
    isArray: Boolean
    jsonPath: String
    query: String
    show: Boolean
    sortable: Boolean
    type: String
      @deprecated(
        reason: "This field is deprecated in favour of displayType. Projects created with v3.0.0 will return null for this query"
      )
  }

  type ColumnSorting {
    fieldName: String
    desc: Boolean
  }

  type TableConfig {
    columns: [ColumnMapping]
    defaultSorting: [ColumnSorting]
    maxResultsWindow: Int
    rowIdFieldName: String
  }
`;

const DownloadsConfigTypeDefs = `
  type DownloadsConfig {
    allowCustomMaxRows: Boolean
    maxRows: Int
  }
`;

const MatchBoxConfigTypeDefs = `
  type MatchBoxMapping {
    displayName: String
    fieldName: String
    isActive: Boolean
    keyFieldName: String
    searchFieldNames: [String]
  }
`;

export default `
  ${DownloadsConfigTypeDefs}
  ${FacetsConfigTypeDefs}
  ${MatchBoxConfigTypeDefs}
  ${TableConfigTypeDefs}
  
  type ConfigsWithState {
    facets: FacetsConfig
    downloads: DownloadsConfig
    extended(fieldNames: [String]): JSON
    matchbox: [MatchBoxMapping] # we may want to rethink this one later
    table: TableConfig
    charts: JSON
  }

  type ConfigsWithoutState {
    downloads: DownloadsConfig
    extended(fieldNames: [String]): JSON
  }
`;
