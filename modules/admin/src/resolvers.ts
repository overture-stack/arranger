import { GraphQLSchema } from 'graphql';
import { I_MergeSchema } from './types';
import { IIndexGqlModel } from './schemas/IndexSchema/types';
import { I_GqlExtendedFieldMapping } from './schemas/ExtendedMapping/types';

export const createIndexByProjectResolver = (
  rootSchema: GraphQLSchema,
): I_MergeSchema<IIndexGqlModel, { graphqlField: string }> => ({
  fragment: `... on Project { id }`,
  resolve: ({ id: projectId }, { graphqlField }, context, info) => {
    return info.mergeInfo.delegateToSchema({
      schema: rootSchema,
      operation: 'query',
      fieldName: 'index',
      args: { projectId, graphqlField },
      context,
      info,
    });
  },
});

export const createIndicesByProjectResolver = (
  rootSchema: GraphQLSchema,
): I_MergeSchema<IIndexGqlModel[], {}> => ({
  fragment: `... on Project { id }`,
  resolve: ({ id: projectId }, args, context, info) => {
    return [];
  },
});

export const createExtendedMappingsByIndexResolver = (
  rootSchema: GraphQLSchema,
): I_MergeSchema<I_GqlExtendedFieldMapping, { field: string }> => ({
  fragment: `... on Index { projectId graphqlField }`,
  resolve: ({ projectId, graphqlField }, { field }, context, info) => {
    return info.mergeInfo.delegateToSchema({
      schema: rootSchema,
      operation: 'query',
      fieldName: 'extendedFieldMappings',
      args: { projectId, graphqlField, field },
      context,
      info,
    });
  },
});
