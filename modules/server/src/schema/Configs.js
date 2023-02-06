// TODO: Add "descriptions" for the fields

export const FacetsConfigTypeDefs = `
  type AggregationMapping {
    active: Boolean
    fieldName: String
    show: Boolean
    type: String
      @deprecated(
        reason: "This field is deprecated in favour of client-side deduction of the type using the es mapping and @arranger/mapping-utils/esToAggTypeMap. This computation will already be done with @Arranger/components. Projects created with 0.4.6 will return null for this query"
      )
  }

  type FacetsConfig {
    aggregations: [AggregationMapping]
  }
`;

export const TableConfigTypeDefs = `
  type ColumnMapping {
    accessor: String
    canChangeShow: Boolean
    displayFormat: String
    displayName: String
    displayValues: JSON
    fieldName: String
    id: String
    isArray: Boolean
    jsonPath: String
    query: String
    show: Boolean
    sortable: Boolean
    type: String
  }

  type ColumnSorting {
    fieldName: String
    desc: Boolean
  }

  type TableConfig {
    columns: [ColumnMapping]
    defaultSorting: [ColumnSorting]
    keyFieldName: String
  }
`;

export const DownloadsConfigTypeDefs = `
  type DownloadsConfig {
    allowCustomMaxRows: Boolean
    maxRows: Int
  }
`;

export const MatchBoxConfigTypeDefs = `
  type MatchBoxMapping {
    displayName: String
    fieldName: String
    isActive: Boolean
    keyFieldName: String
    searchFieldNames: [String]
  }
`;

export const typeDefs = `
  ${FacetsConfigTypeDefs}
  ${DownloadsConfigTypeDefs}
  ${MatchBoxConfigTypeDefs}
  ${TableConfigTypeDefs}

  type ConfigsWithState {
    facets: FacetsConfig
    downloads: DownloadsConfig
    extended(fieldNames: [String]): JSON
    matchbox: [MatchBoxMapping] # we may want to rethink this one later
    table: TableConfig
  }

  type ConfigsWithoutState {
    downloads: DownloadsConfig
    extended(fieldNames: [String]): JSON
  }
`;
