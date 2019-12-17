import { Client } from '@elastic/elasticsearch';
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
import { replaceBy, timestamp } from '../../services';
import { getEsMapping } from '../../services/elasticsearch';
import { sortBy } from 'ramda';

export const getColumnSetState = (es: Client) => async (
  args: I_ColumnStateQueryInput,
): Promise<I_ColumnSetState> => {
  const { graphqlField, projectId } = args;
  const metaData = (await getProjectStorageMetadata(es)(projectId)).find(
    i => i.name === graphqlField,
  );
  return metaData.config['columns-state'];
};

export const createColumnSetState = (es: Client) => async (
  { esIndex }: EsIndexLocation,
  graphqlField: string,
): Promise<I_ColumnSetState> => {
  const rawEsmapping = await getEsMapping(es)({
    esIndex,
  });
  const mapping = rawEsmapping[Object.keys(rawEsmapping)[0]].mappings;
  const columns: I_Column[] = mappingToColumnsState(mapping.properties);
  return {
    state: {
      type: graphqlField,
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
  const sortByNewOrder = sortBy((i: I_Column) =>
    state.columns.findIndex(c => c.field === i.field),
  );
  const mergedState: typeof state = {
    ...state,
    columns: sortByNewOrder(
      replaceBy(
        currentIndexMetadata.config['columns-state'].state.columns,
        state.columns,
        (oldCol, newCol) => oldCol.field === newCol.field,
      ),
    ),
  };
  await updateProjectIndexMetadata(es)({
    projectId,
    metaData: {
      index: currentIndexMetadata.index,
      name: currentIndexMetadata.name,
      config: {
        'columns-state': {
          timestamp: timestamp(),
          state: mergedState,
        },
      },
    },
  });
  return getColumnSetState(es)({ projectId, graphqlField });
};
