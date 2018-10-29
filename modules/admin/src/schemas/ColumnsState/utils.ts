import { Client } from 'elasticsearch';
import { I_Column, I_ColumnSetState, I_ColumnStateQueryInput } from './types';
import { getProjectStorageMetadata } from '../IndexSchema/utils';
import { EsIndexLocation } from '../types';
import { mappingToColumnsState } from '@arranger/mapping-utils';
import { timestamp } from '../../services';
import { getEsMapping } from '../../services/elasticsearch';

export const getColumnSetState = (es: Client) => async (
  args: I_ColumnStateQueryInput,
): Promise<I_ColumnSetState> => {
  const { graphqlField, projectId } = args;
  const metaData = (await getProjectStorageMetadata(es)(projectId)).find(
    i => i.name === graphqlField,
  );
  return metaData.config['columns-state'];
};

export const createColumnSetState = (es: Client) => async ({
  esIndex,
  esType,
}: EsIndexLocation): Promise<I_ColumnSetState> => {
  const rawEsmapping = await getEsMapping(es)({
    esIndex,
    esType,
  });
  const mapping = rawEsmapping[Object.keys(rawEsmapping)[0]].mappings;
  const columns: Array<I_Column> = mappingToColumnsState(mapping);
  return {
    state: {
      type: esType,
      keyField: 'id',
      defaultSorted: [
        { id: columns[0].id || columns[0].accessor, desc: false },
      ],
      columns,
    },
    timestamp: timestamp(),
  };
};
