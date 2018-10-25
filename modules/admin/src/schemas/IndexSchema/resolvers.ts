import { createNewIndex, getProjectIndex } from './utils';
import { IIndexGqlModel, IIndexQueryInput, INewIndexInput } from './types';
import { Resolver } from '../types';

const indexQueryResolver: Resolver<IIndexGqlModel, IIndexQueryInput> = async (
  _,
  args,
  { es },
  info,
) => getProjectIndex(es)(args);

const newIndexMutationResolver: Resolver<
  IIndexGqlModel,
  INewIndexInput
> = async (_, args, { es }, info) => createNewIndex(es)(args);

export default {
  Query: {
    index: indexQueryResolver,
  },
  Mutation: {
    newIndex: newIndexMutationResolver,
  },
};
