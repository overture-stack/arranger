import { Resolver } from '../types';
import {
  I_ColumnSetState,
  I_ColumnStateQueryInput,
  I_SaveColumnsStateMutationInput,
} from './types';
import { getColumnSetState } from './utils';

const columnStateQueryResolver: Resolver<
  I_ColumnSetState,
  I_ColumnStateQueryInput
> = (_, args, { es }) => {
  return getColumnSetState(es)(args);
};

const saveColumnStateMutationResolver: Resolver<
  I_ColumnSetState,
  I_SaveColumnsStateMutationInput
> = (_, args, { es }) => {
  return null;
};
export default {
  Query: {
    columnsState: columnStateQueryResolver,
  },
  Mutation: {
    saveColumnsState: saveColumnStateMutationResolver,
  },
};
