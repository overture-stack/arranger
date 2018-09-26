import { makeExecutableSchema, addMockFunctionsToSchema } from 'graphql-tools';
import { applyMiddleware } from 'graphql-middleware';
import { CONSTANTS } from '@arranger/middleware';
import {
  typeDefs as generateTypeDefs,
  resolvers as generateResolvers,
} from './Root';
import {
  AggsStateTypeDefs,
  ColumnStateTypeDefs,
  MatchBoxStateTypeDefs,
} from './State';

export const StateTypeDefs = {
  AggsStateTypeDefs,
  ColumnStateTypeDefs,
  MatchBoxStateTypeDefs,
};

export const setsMapping = {
  userId: { type: 'keyword' },
  sqon: { type: 'object' },
  ids: { type: 'keyword' },
  setId: { type: 'keyword' },
  type: { type: 'keyword' },
  path: { type: 'keyword' },
  size: { type: 'long' },
  createdAt: { type: 'date' },
};

export default ({
  types = [],
  rootTypes = [],
  scalarTypes = [],
  middleware = [],
  mock = false,
} = {}) => {
  const typesWithSets = [
    ...types,
    [
      'sets',
      {
        es_type: CONSTANTS.ES_ARRANGER_SET_INDEX,
        index: CONSTANTS.ES_ARRANGER_SET_TYPE,
        name: 'sets',
        createState: false,
        nestedFields: [],
        nested_fields: [],
        indexPrefix: '',
        customFields: '',
        extendedFields: [
          {
            active: false,
            displayName: 'ids',
            field: 'ids',
            isArray: true,
            type: 'keyword',
            unit: null,
          },
        ],
        mapping: setsMapping,
      },
    ],
  ];
  let typeDefs = generateTypeDefs({
    types: typesWithSets,
    rootTypes,
    scalarTypes,
  });
  let resolvers = generateResolvers({
    types: typesWithSets,
    rootTypes,
    scalarTypes,
  });

  let schema = makeExecutableSchema({
    typeDefs,
    resolvers,
  });

  if (mock) {
    addMockFunctionsToSchema({
      schema,
      mocks: { JSON: () => JSON.stringify({ key: 'value' }) },
    });
  }

  return applyMiddleware(schema, ...middleware);
};
