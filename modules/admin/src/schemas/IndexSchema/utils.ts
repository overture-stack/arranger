import { Client } from 'elasticsearch';
import { constants } from '../../services/constants';
import { getArrangerProjects } from '../ProjectSchema/utils';
import { getEsMapping } from '../../services/elasticsearch';
import { serializeToGqlField, timestamp } from '../../services';
import {
  IIndexGqlModel,
  IIndexQueryInput,
  IIndexRemovalMutationInput,
  INewIndexInput,
  IProjectIndexMetadata,
} from './types';

const { ARRANGER_PROJECT_INDEX, ARRANGER_PROJECT_TYPE } = constants;

const getProjectMetadataEsLocation = (
  projectId: string,
): {
  index: string;
  type: string;
} => ({
  index: `${ARRANGER_PROJECT_INDEX}-${projectId}`,
  type: `${ARRANGER_PROJECT_TYPE}-${projectId}`,
});

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

const getProjectMetadata = (es: Client) => async (
  projectId: string,
): Promise<IIndexGqlModel[]> => {
  const {
    hits: { hits },
  } = await es.search({
    ...getProjectMetadataEsLocation(projectId),
  });
  const metadataCollection = hits.map(
    ({ _source }) => _source as IProjectIndexMetadata,
  );
  return Promise.all(
    metadataCollection.map(async metadata => ({
      id: `${projectId}-${metadata.name}`,
      hasMapping: mappingExistsOn(es)({
        esIndex: metadata.index,
        esType: metadata.esType,
      }),
      graphqlField: metadata.name,
      projectId: projectId,
      esIndex: metadata.index,
      esType: metadata.esType,
    })),
  );
};

export const getProjectIndex = (es: Client) => async ({
  projectId,
  graphqlField,
}: IIndexQueryInput): Promise<IIndexGqlModel> => {
  return (await getProjectMetadata(es)(projectId)).filter(
    ({ graphqlField: _graphqlField }) => graphqlField === _graphqlField,
  )[0];
};

export const removeProjectIndex = (es: Client) => async ({
  projectId,
  graphqlField,
}: IIndexRemovalMutationInput): Promise<IIndexGqlModel> => {
  const removedIndexMetadata = await getProjectIndex(es)({
    projectId,
    graphqlField,
  });
  await es.delete({
    ...getProjectMetadataEsLocation(projectId),
    id: graphqlField,
  });
  return removedIndexMetadata;
};

export const createNewIndex = (es: Client) => async ({
  projectId,
  graphqlField,
  esIndex,
  esType,
}: INewIndexInput): Promise<IIndexGqlModel> => {
  const arrangerProject: {} = (await getArrangerProjects(es)).find(
    project => project.id === projectId,
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
      ...getProjectMetadataEsLocation(projectId),
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
