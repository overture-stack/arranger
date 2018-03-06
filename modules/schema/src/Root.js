import GraphQLJSON from 'graphql-type-json';
import uuid from 'uuid/v4';
import { startCase, zip } from 'lodash';
import {
  createConnectionResolvers,
  mappingToFields,
} from '@arranger/mapping-utils';
// import { typeDefs as MutationTypeDefs } from './Mutation';
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

    @deprecated(reason: "use [type] { aggsState } instead")
    aggsState(indices: [String]): [AggsStates]

    @deprecated(reason: "use [type] { columnsState } instead")
    columnsState(indices: [String]): [ColumnsStates]

    ${rootTypes.map(([key]) => `${key}: ${startCase(key).replace(/\s/g, '')}`)}
    ${types.map(([key, type]) => `${type.name}: ${type.name}`)}
  }

  ${rootTypes.map(([, type]) => type.typeDefs)}

  type Mutation {
    saveAggsState(graphqlField: String! state: JSON!): AggsState
    saveColumnsState(graphqlField: String! state: JSON!): ColumnsState
  }

  schema {
    query: Root
    mutation: Mutation
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
      aggsState: async (obj, { indices }, { es, projectId }) => {
        let responses = await Promise.all(
          indices.map(index =>
            es.search({
              index: `arranger-projects-${projectId}-${index}-aggs-state`,
              type: `arranger-projects-${projectId}-${index}-aggs-state`,
              body: {
                sort: [{ timestamp: { order: 'desc' } }],
                size: 1,
              },
            }),
          ),
        );

        return zip(indices, responses).map(([index, data]) => ({
          index,
          states: data.hits.hits.map(x => x._source),
        }));
      },
      columnsState: async (obj, { indices }, { es, projectId }) => {
        let responses = await Promise.all(
          indices.map(index =>
            es.search({
              index: `arranger-projects-${projectId}-${index}-columns-state`,
              type: `arranger-projects-${projectId}-${index}-columns-state`,
              body: {
                sort: [{ timestamp: { order: 'desc' } }],
                size: 1,
              },
            }),
          ),
        );

        return zip(indices, responses).map(([index, data]) => ({
          index,
          states: data.hits.hits.map(x => x._source),
        }));
      },
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
    Mutation: {
      saveAggsState: async (
        obj,
        { graphqlField, state },
        { es, projectId, io },
      ) => {
        // TODO: validate / make proper input type
        const type = types.find(t => t.name === graphqlField);
        await es.create({
          index: `arranger-projects-${projectId}-${type.index}-aggs-state`,
          type: `arranger-projects-${projectId}-${type.index}-aggs-state`,
          id: uuid(),
          body: {
            timestamp: new Date().toISOString(),
            state,
          },
          refresh: true,
        });

        let data = await es.search({
          index: `arranger-projects-${projectId}-${type.index}-aggs-state`,
          type: `arranger-projects-${projectId}-${type.index}-aggs-state`,
          body: {
            sort: [{ timestamp: { order: 'desc' } }],
            size: 1,
          },
        });

        io?.emit('server::refresh');

        return data.hits.hits[0]._source;
      },
      saveColumnsState: async (
        obj,
        { graphqlField, state },
        { es, projectId, io },
      ) => {
        // TODO: validate / make proper input type
        const type = types.find(t => t.name === graphqlField);
        await es.create({
          index: `arranger-projects-${projectId}-${type.index}-columns-state`,
          type: `arranger-projects-${projectId}-${type.index}-columns-state`,
          id: uuid(),
          body: {
            timestamp: new Date().toISOString(),
            state,
          },
          refresh: true,
        });

        let data = await es.search({
          index: `arranger-projects-${projectId}-${type.index}-columns-state`,
          type: `arranger-projects-${projectId}-${type.index}-columns-state`,
          body: {
            sort: [{ timestamp: { order: 'desc' } }],
            size: 1,
          },
        });

        io?.emit('server::refresh');

        return data.hits.hits[0]._source;
      },
    },
  };
};
