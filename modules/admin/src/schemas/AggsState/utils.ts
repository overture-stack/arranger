import { Client } from 'elasticsearch';
import { mappingToAggsState } from '@arranger/mapping-utils';
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
  esType,
}: EsIndexLocation): Promise<I_AggsSetState> => {
  const rawEsmapping = await getEsMapping(es)({ esIndex, esType });
  const mapping =
    rawEsmapping[Object.keys(rawEsmapping)[0]].mappings[esType].properties;
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
  const newAggsSetState: I_AggsSetState = {
    timestamp: timestamp(),
    state: currentAggsState.state.map(item => ({
      ...(state.find(_item => _item.field === item.field) || item),
      type: item.type,
    })),
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
