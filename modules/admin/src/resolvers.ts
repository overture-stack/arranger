import { GraphQLSchema } from 'graphql';
import { MergeSchema } from './types';

import { IIndexGqlModel } from './schemas/IndexSchema/types';

export const createIndexByProjectResolver = (
  rootSchema: GraphQLSchema,
): MergeSchema<IIndexGqlModel> => ({
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
