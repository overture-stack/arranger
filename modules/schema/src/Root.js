import GraphQLJSON from 'graphql-type-json';
import { GraphQLDate } from 'graphql-scalars';
import { startCase } from 'lodash';
import Parallel from 'paralleljs';

import { createConnectionResolvers, saveSet, mappingToFields } from '@arranger/mapping-utils';

import { typeDefs as AggregationsTypeDefs } from './Aggregations';
import { typeDefs as SetTypeDefs } from './Sets';
import { typeDefs as SortTypeDefs } from './Sort';
import { typeDefs as StateTypeDefs } from './State';

let RootTypeDefs = ({ types, rootTypes, scalarTypes }) => `
  scalar JSON
  scalar Date
  enum EsRefresh {
    TRUE
    FALSE
    WAIT_FOR
  }

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

    ${rootTypes.map(([key]) => `${key}: ${startCase(key).replace(/\s/g, '')}`)}
    ${types.map(([key, type]) => `${type.name}: ${type.name}`)}
  }

  ${rootTypes.map(([, type]) => type.typeDefs)}

  enum ProjectType {
    ${types.map(([key, type]) => type.name).join('\n')}
  }

  type Mutation {
    saveSet(type: ProjectType! userId: String sqon: JSON! path: String! sort: [Sort] refresh: EsRefresh): Set
  }

  schema {
    query: Root
    mutation: Mutation
  }
`;

export let typeDefs = ({ types, rootTypes, scalarTypes }) => [
  RootTypeDefs({ types, rootTypes, scalarTypes }),
  AggregationsTypeDefs,
  SetTypeDefs,
  SortTypeDefs,
  StateTypeDefs,
  ...types.map(([key, type]) => mappingToFields({ type, parent: '' })),
];

let resolveObject = () => ({});

export let resolvers = ({ types, rootTypes, scalarTypes, getServerSideFilter }) => {
  return {
    JSON: GraphQLJSON,
    Date: GraphQLDate,
    Root: {
      viewer: resolveObject,
      ...[...types, ...rootTypes].reduce(
        (acc, [key, type]) => ({
          ...acc,
          [type.name || key]: resolveObject,
        }),
        {},
      ),
    },
    ...types.reduce(
      (acc, [key, type]) => ({
        ...acc,
        ...createConnectionResolvers({
          type,
          createStateResolvers: 'createState' in type ? type.createState : true,
          Parallel,
          getServerSideFilter,
        }),
      }),
      {},
    ),
    ...rootTypes.reduce(
      (acc, [key, type]) => ({
        ...acc,
        ...(type.resolvers ? { [startCase(key).replace(/\s/g, '')]: type.resolvers } : {}),
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
    Mutation: {
      saveSet: saveSet({ types, getServerSideFilter }),
    },
  };
};
