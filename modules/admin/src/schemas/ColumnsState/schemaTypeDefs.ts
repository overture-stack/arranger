import { gql } from 'apollo-server';
import { StateTypeDefs } from '@arranger/schema/dist';

export default async () => gql`
  ${StateTypeDefs.ColumnStateTypeDefs}

  union ColumnSetState = ColumnsState

  type Query {
    columnsState(projectId: String!, graphqlField: String!): ColumnSetState
  }

  type Mutation {
    saveColumnsState(
      projectId: String!
      graphqlField: String!
      state: ColumnStateInput!
    ): ColumnSetState
  }
`;
