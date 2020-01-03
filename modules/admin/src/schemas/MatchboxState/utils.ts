import { Client } from '@elastic/elasticsearch';
import { mappingToMatchBoxState as extendedFieldsToMatchBoxState } from '@arranger/mapping-utils';
import { I_GqlExtendedFieldMapping } from '../ExtendedMapping/types';
import {
  I_MatchBoxField,
  I_MatchBoxState,
  I_MatchBoxStateQueryInput,
  I_SaveMatchBoxStateMutationInput,
} from './types';
import {
  getProjectStorageMetadata,
  updateProjectIndexMetadata,
} from '../IndexSchema/utils';
import { replaceBy, timestamp } from '../../services';

export const createMatchboxState = ({
  extendedFields,
  graphqlField,
}: {
  extendedFields: Array<I_GqlExtendedFieldMapping>;
  graphqlField: string;
}): I_MatchBoxState => {
  const fields: I_MatchBoxField[] = extendedFieldsToMatchBoxState({
    extendedFields,
    name: graphqlField,
  });
  return { state: fields, timestamp: timestamp() };
};

export const getMatchBoxState = (es: Client) => async ({
  graphqlField,
  projectId,
}: I_MatchBoxStateQueryInput): Promise<I_MatchBoxState> => {
  const currentMetadata = (await getProjectStorageMetadata(es)(projectId)).find(
    i => i.name === graphqlField,
  );
  return currentMetadata.config['matchbox-state'];
};

export const saveMatchBoxState = (es: Client) => async ({
  graphqlField,
  projectId,
  state: updatedMatchboxFields,
}: I_SaveMatchBoxStateMutationInput): Promise<I_MatchBoxState> => {
  const currentMetadata = (await getProjectStorageMetadata(es)(projectId)).find(
    i => i.name === graphqlField,
  );
  const currentMatchboxFields = currentMetadata.config['matchbox-state'].state;
  const newMatchboxState: I_MatchBoxState = {
    timestamp: timestamp(),
    state: replaceBy(
      currentMatchboxFields,
      updatedMatchboxFields,
      ({ field: field1 }, { field: field2 }) => field1 === field2,
    ),
  };

  await updateProjectIndexMetadata(es)({
    projectId,
    metaData: {
      index: currentMetadata.index,
      name: currentMetadata.name,
      config: {
        'matchbox-state': newMatchboxState,
      },
    },
  });

  return newMatchboxState;
};
