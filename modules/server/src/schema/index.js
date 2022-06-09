import { makeExecutableSchema, addMockFunctionsToSchema } from 'graphql-tools';
import { applyMiddleware } from 'graphql-middleware';

import { CONSTANTS } from '../middleware';

import { FacetsConfigTypeDefs, MatchBoxConfigTypeDefs, TableConfigTypeDefs } from './Configs';
import { typeDefs as generateTypeDefs, resolvers as generateResolvers } from './Root';

export const ConfigsTypeDefs = {
  FacetsConfigTypeDefs,
  TableConfigTypeDefs,
  MatchBoxConfigTypeDefs,
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
  enableAdmin = false,
  getServerSideFilter,
  middleware = [],
  mock = false,
  rootTypes = [],
  scalarTypes = [],
  types = [],
} = {}) => {
  const typesWithSets = [
    types,
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

  const typeDefs = generateTypeDefs({
    rootTypes,
    scalarTypes,
    types: typesWithSets,
  });

  const resolvers = generateResolvers({
    enableAdmin,
    getServerSideFilter,
    rootTypes,
    scalarTypes,
    types: typesWithSets,
  });

  const schema = makeExecutableSchema({
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
