import { gql } from 'apollo-server';

export default async () => gql`
  type Index {
    id: ID!
    hasMapping: Boolean!
    graphqlField: String!
    projectId: String!
    esIndex: String!
    esType: String!
  }
  type Query {
    index(projectId: ID!, graphqlField: String!): Index
  }
  type Mutation {
    newIndex(projectId: String!, graphqlField: String!, esIndex: String!): Index
    deleteIndex(projectId: ID!, graphqlField: String!): Index
  }
`;
