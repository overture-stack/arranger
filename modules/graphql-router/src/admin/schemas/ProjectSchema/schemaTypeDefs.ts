import { gql } from 'apollo-server';

export default async () => gql`
  type Project {
    id: ID!
    active: Boolean!
    timestamp: String!
  }

  type Query {
    projects: [Project]
    project(id: String!): Project
  }

  type Mutation {
    newProject(id: String!): [Project]
    deleteProject(id: String!): [Project]
  }
`;
