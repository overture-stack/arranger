import { makeExecutableSchema, addMockFunctionsToSchema } from 'graphql-tools';
import {
  typeDefs as generateTypeDefs,
  resolvers as generateResolvers,
} from './Root';

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

module.exports = ({
  types = [],
  rootTypes = [],
  scalarTypes = [],
  mock = false,
} = {}) => {
  const typesWithSets = [
    ...types,
    [
      'sets',
      {
        es_type: 'arranger-sets',
        index: 'arranger-sets',
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

  return schema;
};
