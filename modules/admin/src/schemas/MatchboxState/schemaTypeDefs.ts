import { gql } from 'apollo-server';
import { StateTypeDefs } from '@arranger/schema';

export default async () => gql`
  ${StateTypeDefs.MatchBoxStateTypeDefs}

  input MatchBoxFieldInput {
    displayName: String
    field: String
    isActive: Boolean
    keyField: String
    searchFields: [String]
  }

  type Query {
    matchBoxState(projectId: String!, graphqlField: String!): MatchBoxState
  }

  type Mutation {
    saveMatchBoxState(
      projectId: String!
      graphqlField: String!
      state: [MatchBoxFieldInput]
    ): MatchBoxState
  }
`;
