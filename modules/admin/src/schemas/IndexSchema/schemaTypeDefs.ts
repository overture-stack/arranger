import { gql } from 'apollo-server';

export default async () => gql`
  type Index {
    id: ID!
    hasMapping: Boolean!
    graphqlField: String!
    projectId: String!
  }
  type Query {
    index(projectId: ID!, graphqlField: String!): Index
  }
  type Mutation {
    newIndex(
      projectId: String!
      graphqlField: String!
      esIndex: String!
      esType: String!
    ): Index
    deleteIndex(projectId: ID!, graphqlField: String!): Index
  }
`;
