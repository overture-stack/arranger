import { Resolver } from '../types';
import * as GraphQLJSON from 'graphql-type-json';
import {
  I_ExtendedFieldsMappingsQueryArgs,
  I_GqlExtendedFieldMapping,
  I_SaveExtendedMappingMutationArgs,
  I_UpdateExtendedMappingMutationArgs,
} from './types';
import {
  getExtendedMapping,
  saveExtendedMapping,
  updateFieldExtendedMapping,
} from './utils';

const extendedMappingQueryResolver: Resolver<
  I_GqlExtendedFieldMapping[],
  I_ExtendedFieldsMappingsQueryArgs
> = (_, { projectId, graphqlField, field }, { es }) => {
  return getExtendedMapping(es)({ projectId, graphqlField, field });
};

const updateExtendedMappingMutationResolver: Resolver<
  I_GqlExtendedFieldMapping,
  I_UpdateExtendedMappingMutationArgs
> = (_, args, { es }) => updateFieldExtendedMapping(es)(args);

const saveExtendedMappingMutationResolver: Resolver<
  I_GqlExtendedFieldMapping[],
  I_SaveExtendedMappingMutationArgs
> = (_, args, { es }) => saveExtendedMapping(es)(args);

export default {
  JSON: GraphQLJSON,
  Query: {
    extendedFieldMappings: extendedMappingQueryResolver,
  },
  Mutation: {
    updateExtendedMapping: updateExtendedMappingMutationResolver,
    saveExtendedMapping: saveExtendedMappingMutationResolver,
  },
};
