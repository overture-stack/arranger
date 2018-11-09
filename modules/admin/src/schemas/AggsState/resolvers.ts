import { GraphQLResolveInfo } from 'graphql';
import { IQueryContext } from '../../types';
import {
  I_AggsSetState,
  I_AggsStateQueryInput,
  I_SaveAggsStateMutationInput,
} from './types';
import { getAggsSetState, saveAggsSetState } from './utils';
import { Resolver } from '../types';

const saveAggsStateMutationResolver: Resolver<
  I_AggsSetState,
  I_SaveAggsStateMutationInput
> = async (
  obj: {},
  args,
  { es }: IQueryContext,
  info: GraphQLResolveInfo,
): Promise<I_AggsSetState> => {
  return await saveAggsSetState(es)(args);
};

const aggsStateQueryResolver: Resolver<
  I_AggsSetState,
  I_AggsStateQueryInput
> = (
  obj: {},
  args,
  { es }: IQueryContext,
  info: GraphQLResolveInfo,
): Promise<I_AggsSetState> => {
  return getAggsSetState(es)(args);
};

export default {
  Query: {
    aggsState: aggsStateQueryResolver,
  },
  Mutation: {
    saveAggsState: saveAggsStateMutationResolver,
  },
};
