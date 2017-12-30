import { makeExecutableSchema } from 'graphql-tools'
import {
  typeDefs as generateTypeDefs,
  resolvers as generateResolvers,
} from './Root'

module.exports = ({
  types = [[]],
  rootTypes = [[]],
  scalarTypes = [[]],
} = {}) => {
  let typeDefs = generateTypeDefs({ types, rootTypes, scalarTypes })
  let resolvers = generateResolvers({ types, rootTypes, scalarTypes })

  return makeExecutableSchema({
    typeDefs,
    resolvers,
  })
}
