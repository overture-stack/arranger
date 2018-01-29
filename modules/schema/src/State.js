export let typeDefs = `
  type AggState {
    field: String
    type: String
    active: Boolean
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
    listAccessor: String
    totalAccessor: String
    id: String
    accessor: String
  }

  type ColumnsState {
    timestamp: String
    type: String
    keyField: String
    defaultSorted: [ColumnSort]
    columns: [Column]
  }

  type ColumnsStates {
    index: String
    states: [ColumnsState]
  }
`;
