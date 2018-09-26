import { gql } from 'apollo-server';
import { StateTypeDefs } from '@arranger/schema';

export default gql`
  ${StateTypeDefs.AggsStateTypeDefs}

  ########### ROOTS ###########
  type Query {
    aggsState(projectId: String!, graphqlField: String!): AggsState
  }
  type Mutation {
    saveAggsState(
      projectId: String!
      graphlField: String!
      state: AggStateInput!
    ): AggsState
  }
`;
