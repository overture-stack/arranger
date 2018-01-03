import { makeExecutableSchema, addMockFunctionsToSchema } from 'graphql-tools'
import {
  typeDefs as generateTypeDefs,
  resolvers as generateResolvers,
} from './Root'

module.exports = ({
  types = [],
  rootTypes = [],
  scalarTypes = [],
  mock = false,
} = {}) => {
  let typeDefs = generateTypeDefs({ types, rootTypes, scalarTypes })
  let resolvers = generateResolvers({ types, rootTypes, scalarTypes })

  let schema = makeExecutableSchema({
    typeDefs,
    resolvers,
  })

  if (mock) {
    addMockFunctionsToSchema({
      schema,
      mocks: { JSON: () => JSON.stringify({ key: 'value' }) },
    })
  }

  return schema
}
