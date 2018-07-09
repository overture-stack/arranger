export let typeDefs = `
  type AggState {
    field: String
    type: String @deprecated(reason: "This field is deprecated in favour of client-side deduction of the type using the es mapping and @arranger/mapping-utils/esToAggTypeMap. This computation will already be done with @Arranger/components. Projects created with 0.4.6 will return null for this query")
    active: Boolean
    show: Boolean
  }

  type AggsState {
    timestamp: String
    state: [AggState]
  }

  type AggsStates {
    index: String
    states: [AggsState]
  }

  type ColumnSort {
    id: String
    desc: Boolean
  }

  type Column {
    show: Boolean
    type: String
    sortable: Boolean
    canChangeShow: Boolean
    query: String
    jsonPath: String
    id: String
    field: String
    accessor: String
  }

  type ColumnState {
    type: String
    keyField: String
    defaultSorted: [ColumnSort]
    columns: [Column]
  }

  type ColumnsState {
    state: ColumnState
    timestamp: String
  }

  type ColumnsStates {
    index: String
    states: [ColumnsState]
  }

  type MatchBoxField {
    displayName: String
    field: String
    isActive: Boolean
    keyField: String
    searchFields: [String]
  }

  type MatchBoxState {
    state: [MatchBoxField]
    timestamp: String
  }

  type MatchBoxStates {
    index: String
    states: [MatchBoxState]
  }
`;
