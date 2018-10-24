import { Client } from 'elasticsearch';

import { constants } from '../../services/constants';
import { serializeToGqlField, timestamp } from '../../services';
import { getEsMapping } from '../../services/elasticsearch';
import { getArrangerProjects } from '../ProjectSchema/utils';

const { ARRANGER_PROJECT_INDEX, ARRANGER_PROJECT_TYPE } = constants;

interface IIndexStorageModel {
  indes: string;
  name: string;
  esType: string;
  config: object;
  active: boolean;
  timestamp: string;
}

interface IIndexModel {
  hasMapping: boolean;
  graphqlField: string;
  projectId: string;
  esIndex: string;
  esType: string;
}

const mappingExistsOn = (es: Client) => async ({
  esIndex,
  esType,
}: {
  esIndex: string;
  esType: string;
}): Promise<boolean> => {
  try {
    await getEsMapping(es)({ esIndex, esType });
    return true;
  } catch (err) {
    return false;
  }
};

export const getProjectIndexData = (es: Client) => async (
  projectId: string,
  graphqlField: string,
): Promise<IIndexModel> => {
  return null;
};

export const createNewIndex = (es: Client) => async (
  projectId: string,
  graphqlField: string,
  esIndex: string,
  esType: string,
): Promise<IIndexModel> => {
  const arrangerProject: {} = (await getArrangerProjects(es)).find(
    (project: { id: string }) => project.id === projectId,
  );
  const serializedGqlField = serializeToGqlField(graphqlField);
  if (arrangerProject) {
    let hasMapping: boolean = mappingExistsOn(es)({ esIndex, esType });
    return getProjectIndexData(es)(projectId, graphqlField);
  } else {
    throw new Error(`no project with ID ${projectId} was found`);
  }
};
