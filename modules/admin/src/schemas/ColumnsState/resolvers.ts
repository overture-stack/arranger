import { Resolver } from '../types';
import {
  I_ColumnSetState,
  I_ColumnStateQueryInput,
  I_SaveColumnsStateMutationInput,
} from './types';
import { getColumnSetState, saveColumnState } from './utils';

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
  return saveColumnState(es)(args);
};

// this is a hack to rename "ColumnsState" to "ColumnSetState" in graphql because juggling "ColumnsState" and "ColumnState" is just too much
const ColumnSetStateTypeResolver = {
  __resolveType: () => 'ColumnsState',
};

export default {
  ColumnSetState: ColumnSetStateTypeResolver,
  Query: {
    columnsState: columnStateQueryResolver,
  },
  Mutation: {
    saveColumnsState: saveColumnStateMutationResolver,
  },
};
