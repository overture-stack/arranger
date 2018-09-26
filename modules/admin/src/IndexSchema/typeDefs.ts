import { gql } from 'apollo-server';

export default async () => gql`
  type Index {
    hasMapping: Boolean!
    graphqlField: String!
    projectId: String!
  }
  type Query {
    index(projectId: String!, graphqlField: String!): Index
    indices(projectId: String!): [Index]
  }
  type Mutation {
    newIndex(
      projectId: String!
      graphqlField: String!
      esIndex: String!
      esType: String!
    ): Index
    deleteIndex(projectId: String!, graphqlField: String!): Index
  }
`;
