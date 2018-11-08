import { createNewIndex, getProjectIndex, removeProjectIndex } from './utils';
import {
  IIndexGqlModel,
  IIndexQueryInput,
  IIndexRemovalMutationInput,
  INewIndexInput,
} from './types';
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

const removeIndexMutationResolver: Resolver<
  IIndexGqlModel,
  IIndexRemovalMutationInput
> = async (_, args, { es }, info) => removeProjectIndex(es)(args);

export default {
  Query: {
    index: indexQueryResolver,
  },
  Mutation: {
    newIndex: newIndexMutationResolver,
    deleteIndex: removeIndexMutationResolver,
  },
};
