import { GraphQLSchema } from 'graphql';
import { IMergeSchema } from './types';
import { IIndexGqlModel } from './schemas/IndexSchema/types';

export const createIndexByProjectResolver = (
  rootSchema: GraphQLSchema,
): IMergeSchema<IIndexGqlModel, { graphqlField: string }> => ({
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
): IMergeSchema<Array<IIndexGqlModel>, {}> => ({
  fragment: `... on Project { id }`,
  resolve: ({ id: projectId }, args, context, info) => {
    return [];
  },
});
