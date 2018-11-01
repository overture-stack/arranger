import { Client } from 'elasticsearch';
import {
  I_Column,
  I_ColumnSetState,
  I_ColumnStateQueryInput,
  I_SaveColumnsStateMutationInput,
} from './types';
import {
  getProjectStorageMetadata,
  updateProjectIndexMetadata,
} from '../IndexSchema/utils';
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
  const columns: I_Column[] = mappingToColumnsState(mapping);
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

export const saveColumnState = (es: Client) => async ({
  graphqlField,
  projectId,
  state,
}: I_SaveColumnsStateMutationInput): Promise<I_ColumnSetState> => {
  const currentProjectMetadata = await getProjectStorageMetadata(es)(projectId);
  const currentIndexMetadata = currentProjectMetadata.find(
    i => i.name === graphqlField,
  );
  await updateProjectIndexMetadata(es)({
    projectId,
    metaData: {
      index: currentIndexMetadata.index,
      name: currentIndexMetadata.name,
      config: {
        'columns-state': {
          timestamp: timestamp(),
          state,
        },
      },
    },
  });
  return getColumnSetState(es)({ projectId, graphqlField });
};
