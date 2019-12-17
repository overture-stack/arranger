import { Client } from '@elastic/elasticsearch';
import { mappingToAggsState } from '@arranger/mapping-utils';
import { sortBy } from 'ramda';
import {
  I_AggsSetState,
  I_AggsState,
  I_AggsStateQueryInput,
  I_SaveAggsStateMutationInput,
} from './types';
import { timestamp } from '../../services';
import {
  getProjectStorageMetadata,
  updateProjectIndexMetadata,
} from '../IndexSchema/utils';
import { EsIndexLocation } from '../types';
import { getEsMapping } from '../../services/elasticsearch';

export const createAggsSetState = (es: Client) => async ({
  esIndex,
}: EsIndexLocation): Promise<I_AggsSetState> => {
  const rawEsmapping = await getEsMapping(es)({ esIndex });
  const mapping =
    rawEsmapping[Object.keys(rawEsmapping)[0]].mappings.properties;
  const aggsState: I_AggsState[] = mappingToAggsState(mapping);
  return { timestamp: timestamp(), state: aggsState };
};

export const getAggsSetState = (es: Client) => async (
  args: I_AggsStateQueryInput,
): Promise<I_AggsSetState> => {
  const { projectId, graphqlField } = args;
  const metaData = (await getProjectStorageMetadata(es)(projectId)).find(
    entry => entry.name === graphqlField,
  );
  return metaData.config['aggs-state'];
};

export const saveAggsSetState = (es: Client) => async (
  args: I_SaveAggsStateMutationInput,
): Promise<I_AggsSetState> => {
  const { graphqlField, projectId, state } = args;
  const currentMetadata = (await getProjectStorageMetadata(es)(projectId)).find(
    i => i.name === graphqlField,
  );
  const currentAggsState = currentMetadata.config['aggs-state'];
  const sortByNewOrder = sortBy((i: I_AggsState) =>
    state.findIndex(_i => _i.field === i.field),
  );
  const newAggsSetState: typeof currentAggsState = {
    timestamp: timestamp(),
    state: sortByNewOrder(
      currentAggsState.state.map(item => ({
        ...(state.find(_item => _item.field === item.field) || item),
        type: item.type,
      })),
    ),
  };

  await updateProjectIndexMetadata(es)({
    projectId,
    metaData: {
      index: currentMetadata.index,
      name: currentMetadata.name,
      config: {
        'aggs-state': newAggsSetState,
      },
    },
  });

  return newAggsSetState;
};
