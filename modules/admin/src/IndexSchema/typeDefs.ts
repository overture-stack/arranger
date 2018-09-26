import { gql } from 'apollo-server';

export default async () => gql`
  type Index {
    hasMapping: Boolean!
    graphqlField: String!
    projectName: String!
  }
  type Query {
    index(projectName: String!, graphqlField: String!): Index
    indices(projectName: String!): [Index]
  }
  type Mutation {
    newIndex(
      projectName: String!
      graphqlField: String!
      esIndex: String!
      esType: String!
    ): Index
    deleteIndex(projectName: String!, graphqlField: String!): Index
  }
`;
