import { StateTypeDefs } from '@arranger/schema'
import { gql } from 'apollo-server-core';


const typeDefs = gql`
  ${StateTypeDefs}
  type Query {

  }
`

const resolvers = {
  Query: {

  }
}