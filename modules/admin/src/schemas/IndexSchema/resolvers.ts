import { QueryContext } from '../..';
import { GraphQLResolveInfo } from 'graphql';
import { createNewIndex, getProjectIndex } from './utils';

export interface IIndexQueryInput {
  projectId: string;
  graphqlField: string;
}

export interface INewIndexInput {
  projectId: string;
  graphqlField: string;
  esIndex: string;
  esType: string;
}

const indexQueryResolver = async (
  _: {},
  args: IIndexQueryInput,
  { es }: QueryContext,
  info: GraphQLResolveInfo,
) => getProjectIndex(es)(args);

const newIndexMutationResolver = async (
  _: {},
  args: INewIndexInput,
  { es }: QueryContext,
  info: GraphQLResolveInfo,
) => createNewIndex(es)(args);

export default {
  Query: {
    index: indexQueryResolver,
  },
  Mutation: {
    newIndex: newIndexMutationResolver,
  },
};
