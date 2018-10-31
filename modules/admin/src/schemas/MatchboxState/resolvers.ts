import { Resolver } from '../types';
import {
  I_MatchBoxState,
  I_MatchBoxStateQueryInput,
  I_SaveMatchBoxStateMutationInput,
} from './types';

const matchBoxStateQueryResolver: Resolver<
  I_MatchBoxState,
  I_MatchBoxStateQueryInput
> = (_, args, { es }, info) => {
  return null;
};

const saveMatchBoxStateMutationResolver: Resolver<
  I_MatchBoxState,
  I_SaveMatchBoxStateMutationInput
> = (_, args, { es }, info) => {
  return null;
};

export default {
  Query: {
    matchBoxState: matchBoxStateQueryResolver,
  },
  Mutation: {
    saveMatchBoxState: saveMatchBoxStateMutationResolver,
  },
};
