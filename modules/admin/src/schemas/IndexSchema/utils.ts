import { Client } from 'elasticsearch';
import { constants } from '../../services/constants';
import { getArrangerProjects } from '../ProjectSchema/utils';
import { getEsMapping } from '../../services/elasticsearch';
import { serializeToGqlField, timestamp } from '../../services';
import {
  IIndexGqlModel,
  IIndexQueryInput,
  IIndexRemovalQueryInput,
  INewIndexInput,
  IProjectIndexMetadata,
} from './types';

const { ARRANGER_PROJECT_INDEX, ARRANGER_PROJECT_TYPE } = constants;

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

export const getProjectIndex = (es: Client) => async ({
  projectId,
  graphqlField,
}: IIndexQueryInput): Promise<IIndexGqlModel> => {
  const {
    hits: { hits },
  } = await es.search({
    index: `${ARRANGER_PROJECT_INDEX}-${projectId}`,
    type: `${ARRANGER_PROJECT_TYPE}-${projectId}`,
  });
  const metadataCollection = hits.map(
    ({ _source }: any) => _source as IProjectIndexMetadata,
  );
  return metadataCollection
    .filter(({ name }: IProjectIndexMetadata) => graphqlField === name)
    .map(
      async (metadata: IProjectIndexMetadata): Promise<IIndexGqlModel> => ({
        id: `${projectId}-${graphqlField}`,
        hasMapping: () =>
          mappingExistsOn(es)({
            esIndex: metadata.index,
            esType: metadata.esType,
          }),
        graphqlField: metadata.name,
        projectId: projectId,
        esIndex: metadata.index,
        esType: metadata.esType,
      }),
    )[0];
};

export const removeProjectIndex = (es: Client) => async ({
  projectId,
  graphqlField,
}: IIndexRemovalQueryInput): Promise<IIndexGqlModel> => {
  return null;
};

export const createNewIndex = (es: Client) => async ({
  projectId,
  graphqlField,
  esIndex,
  esType,
}: INewIndexInput): Promise<IIndexGqlModel> => {
  const arrangerProject: {} = (await getArrangerProjects(es)).find(
    (project: { id: string }) => project.id === projectId,
  );
  if (arrangerProject) {
    const serializedGqlField = serializeToGqlField(graphqlField);

    const metadataContent: IProjectIndexMetadata = {
      index: esIndex,
      name: serializedGqlField,
      esType: esType,
      timestamp: timestamp(),
      active: true,
      config: { 'aggs-state': [], 'columns-state': {}, extended: [] },
    };

    await es.create({
      index: `${ARRANGER_PROJECT_INDEX}-${projectId}`,
      type: `${ARRANGER_PROJECT_TYPE}-${projectId}`,
      id: esIndex,
      body: metadataContent,
    });

    return getProjectIndex(es)({
      projectId,
      graphqlField: serializedGqlField,
    });
  } else {
    throw new Error(`no project with ID ${projectId} was found`);
  }
};
