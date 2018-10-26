import { Client } from 'elasticsearch';
import {
  I_ColumnSetState,
  I_ColumnState,
  I_ColumnStateQueryInput,
} from './types';
import { getProjectStorageMetadata } from '../IndexSchema/utils';
import { EsIndexLocation } from '../types';

export const createColumnSetState = (es: Client) => async (
  args: EsIndexLocation,
): Promise<I_ColumnState> => {
  return null;
};

export const getColumnSetState = (es: Client) => async (
  args: I_ColumnStateQueryInput,
): Promise<I_ColumnSetState> => {
  const { graphqlField, projectId } = args;
  const metaData = (await getProjectStorageMetadata(es)(projectId)).find(
    i => i.name === graphqlField,
  );
  return metaData.config['columns-state'];
};
