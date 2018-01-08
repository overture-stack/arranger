import GraphQLJSON from 'graphql-type-json';
import { startCase, zip } from 'lodash';
import {
  createConnectionResolvers,
  mappingToFields,
} from '@arranger/mapping-utils';
import { typeDefs as MutationTypeDefs } from './Mutation';
import { typeDefs as AggregationsTypeDefs } from './Aggregations';
import { typeDefs as SortTypeDefs } from './Sort';
import { typeDefs as StateTypeDefs } from './State';

let RootTypeDefs = ({ types, rootTypes, scalarTypes }) => `
  scalar JSON

  ${scalarTypes.map(([type]) => `scalar ${type}`)}

  interface Node {
    id: ID!
  }

  type FileSize {
    value: Float
  }

  type QueryResults {
    total: Int
    hits: [Node]
  }

  type Root {
    node(id: ID!): Node
    viewer: Root
    query(query: String, types: [String]): QueryResults
    aggsState(indices: [String]): [AggsStates]
    ${rootTypes.map(([key]) => `${key}: ${startCase(key).replace(/\s/g, '')}`)}
    ${types.map(([key, type]) => `${key}: ${type.name}`)}
  }

  ${rootTypes.map(([, type]) => type.typeDefs)}

  schema {
    query: Root
    # mutation: Mutation
  }
`;

export let typeDefs = ({ types, rootTypes, scalarTypes }) => [
  RootTypeDefs({ types, rootTypes, scalarTypes }),
  // MutationTypeDefs,
  AggregationsTypeDefs,
  SortTypeDefs,
  StateTypeDefs,
  ...types.map(([key, type]) => mappingToFields({ key, type })),
];

let resolveObject = () => ({});

export let resolvers = ({ types, rootTypes, scalarTypes }) => {
  return {
    JSON: GraphQLJSON,
    Root: {
      aggsState: async (obj, { indices }, { es }) => {
        let responses = await Promise.all(
          indices.map(index =>
            es.search({
              index: `${index}-aggs-state`,
              type: `${index}-aggs-state`,
            }),
          ),
        );

        return zip(indices, responses).map(([index, data]) => ({
          index,
          states: data.hits.hits.map(x => x._source)
        }));
      },
      viewer: resolveObject,
      ...[...types, ...rootTypes].reduce(
        (acc, [key]) => ({
          ...acc,
          [key]: resolveObject,
        }),
        {},
      ),
    },
    ...types.reduce(
      (acc, [key, type]) => ({
        ...acc,
        ...createConnectionResolvers({
          type,
        }),
      }),
      {},
    ),
    ...rootTypes.reduce(
      (acc, [key, type]) => ({
        ...acc,
        ...(type.resolvers
          ? { [startCase(key).replace(/\s/g, '')]: type.resolvers }
          : {}),
      }),
      {},
    ),
    ...scalarTypes.reduce(
      (acc, [scalar, resolver]) => ({
        ...acc,
        [scalar]: resolver,
      }),
      {},
    ),
  };
};
