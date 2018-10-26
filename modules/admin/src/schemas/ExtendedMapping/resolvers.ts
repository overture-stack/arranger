import { Resolver } from '../types';
import * as GraphQLJSON from 'graphql-type-json';
import {
  I_ExtendedFieldsMappingsQueryArgs,
  I_GqlExtendedFieldMapping,
  I_UpdateExtendedMappingMutationArgs,
} from './types';
import { getExtendedMapping, updateFieldExtendedMapping } from './utils';

const extendedMappingQueryResolver: Resolver<
  Array<I_GqlExtendedFieldMapping>,
  I_ExtendedFieldsMappingsQueryArgs
> = (_, { projectId, graphqlField, field }, { es }) => {
  return getExtendedMapping(es)({ projectId, graphqlField, field });
};

const updateExtendedMappingMutationResolver: Resolver<
  I_GqlExtendedFieldMapping,
  I_UpdateExtendedMappingMutationArgs
> = (_, args, { es }) => updateFieldExtendedMapping(es)(args);

export default {
  JSON: GraphQLJSON,
  Query: {
    extendedFieldMappings: extendedMappingQueryResolver,
  },
  Mutation: {
    updateExtendedMapping: updateExtendedMappingMutationResolver,
  },
};
