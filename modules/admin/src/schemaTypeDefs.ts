import { gql } from 'apollo-server';

export default gql`
  extend type Index {
    aggsState: AggsState
    columnsState: ColumnSetState
    extended(field: String): [ExtendedFieldMapping]
  }

  extend type Project {
    index(graphqlField: String!): Index
    indices: [Index]
  }
`;
