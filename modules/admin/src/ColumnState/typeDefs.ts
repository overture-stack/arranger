import { gql } from 'apollo-server';

export default gql`
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

  input ColumnStateInput {
    type: String
    keyField: String
    defaultSorted: [ColumnSort]
    columns: [Column]
  }

  Mutation {
    saveColumnsState(graphqlField: String! state: ColumnStateInput!) :ColumnsState
  }
`;
