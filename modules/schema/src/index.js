import { makeExecutableSchema, addMockFunctionsToSchema } from 'graphql-tools';
import { applyMiddleware } from 'graphql-middleware';
import { CONSTANTS } from '@arranger/middleware';
import { typeDefs as generateTypeDefs, resolvers as generateResolvers } from './Root';
import { AggsStateTypeDefs, ColumnStateTypeDefs, MatchBoxStateTypeDefs } from './State';

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
  enableAdmin,
  getServerSideFilter,
} = {}) => {
  const typesWithSets = [
    ...types,
    [
      'sets',
      {
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
    enableAdmin,
  });
  let resolvers = generateResolvers({
    types: typesWithSets,
    rootTypes,
    scalarTypes,
    enableAdmin,
    getServerSideFilter,
  });

  let schema = makeExecutableSchema({
    typeDefs,
    resolvers,
    resolverValidationOptions: {
      // this disables a warning which we are ok with (https://github.com/prisma/prisma/issues/2225)
      requireResolversForResolveType: false,
    },
  });

  if (mock) {
    addMockFunctionsToSchema({
      schema,
      mocks: { JSON: () => JSON.stringify({ key: 'value' }) },
    });
  }

  return applyMiddleware(schema, ...middleware);
};
