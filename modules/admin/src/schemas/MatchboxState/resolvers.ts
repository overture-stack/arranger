import { Resolver } from '../types';
import {
  I_MatchBoxState,
  I_MatchBoxStateQueryInput,
  I_SaveMatchBoxStateMutationInput,
} from './types';
import { getMatchBoxState, saveMatchBoxState } from './utils';

const matchBoxStateQueryResolver: Resolver<
  I_MatchBoxState,
  I_MatchBoxStateQueryInput
> = (_, args, { es }, info) => {
  return getMatchBoxState(es)(args);
};

const saveMatchBoxStateMutationResolver: Resolver<
  I_MatchBoxState,
  I_SaveMatchBoxStateMutationInput
> = (_, args, { es }, info) => {
  return saveMatchBoxState(es)(args);
};

export default {
  Query: {
    matchBoxState: matchBoxStateQueryResolver,
  },
  Mutation: {
    saveMatchBoxState: saveMatchBoxStateMutationResolver,
  },
};
