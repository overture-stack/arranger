import { gql } from 'apollo-server';
import { StateTypeDefs } from '@arranger/schema';

export default gql`
  ${StateTypeDefs.ColumnStateTypeDefs}
  ########### ROOTS ###########
  type Query {
    columnsState(projectId: String!, graphqlField: String!): ColumnsState
  }

  type Mutation {
    # mutation to save table columns configuration
    saveColumnsState(
      projectId: String!
      graphqlField: String!
      state: ColumnStateInput!
    ): ColumnsState
  }
`;
