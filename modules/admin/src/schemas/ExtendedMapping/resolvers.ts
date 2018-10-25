import { Resolver } from '../types';
import GraphQLJSON from 'graphql-type-json';
import {
  I_GqlExtendedFieldMapping,
  I_ExtendedFieldsMappingsQueryArgs,
} from './types';
import { getExtendedMapping } from './utils';

const extendedMappingQueryResolver: Resolver<
  Array<I_GqlExtendedFieldMapping>,
  I_ExtendedFieldsMappingsQueryArgs
> = (_, { projectId, graphqlField, field }, { es }) => {
  return getExtendedMapping(es)({ projectId, graphqlField, field });
};

export default {
  JSON: GraphQLJSON,
  Query: {
    extendedFieldMappings: extendedMappingQueryResolver,
  },
};
