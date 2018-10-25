import { gql } from 'apollo-server';
import { StateTypeDefs } from '@arranger/schema/dist';

export default async () => gql`
  ${StateTypeDefs.ColumnStateTypeDefs}

  type Query {
    columnsState(projectId: String!, graphqlField: String!): ColumnsState
  }

  type Mutation {
    saveColumnsState(
      projectId: String!
      graphqlField: String!
      state: ColumnStateInput!
    ): ColumnsState
  }
`;
