import { Client } from 'elasticsearch';
import { UserInputError } from 'apollo-server';

import { getEsMapping } from '../../services/elasticsearch';
import { constants } from '../../services/constants';
import { serializeToGqlField, timestamp } from '../../services';
import { createExtendedMapping } from '../ExtendedMapping/utils';
import { getArrangerProjects } from '../ProjectSchema/utils';
import { EsIndexLocation } from '../types';
import {
  IIndexGqlModel,
  IIndexQueryInput,
  IIndexRemovalMutationInput,
  INewIndexInput,
  IProjectIndexMetadata,
} from './types';
import { createColumnSetState } from '../ColumnsState/utils';

const { ARRANGER_PROJECT_INDEX, ARRANGER_PROJECT_TYPE } = constants;

export const getProjectMetadataEsLocation = (
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
}: EsIndexLocation): Promise<boolean> => {
  try {
    await getEsMapping(es)({ esIndex, esType });
    return true;
  } catch (err) {
    return false;
  }
};

export const getProjectStorageMetadata = (es: Client) => async (
  projectId: string,
): Promise<Array<IProjectIndexMetadata>> => {
  try {
    const {
      hits: { hits },
    } = await es.search({
      ...getProjectMetadataEsLocation(projectId),
    });
    return hits.map(({ _source }) => _source as IProjectIndexMetadata);
  } catch (err) {
    throw new UserInputError(`cannot find project of id ${projectId}`, err);
  }
};

const getProjectMetadata = (es: Client) => async (
  projectId: string,
): Promise<IIndexGqlModel[]> =>
  Promise.all(
    (await getProjectStorageMetadata(es)(projectId)).map(async metadata => ({
      id: `${projectId}::${metadata.name}`,
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

export const createNewIndex = (es: Client) => async (
  args: INewIndexInput,
): Promise<IIndexGqlModel> => {
  const { projectId, graphqlField, esIndex, esType } = args;
  const arrangerProject: {} = (await getArrangerProjects(es)).find(
    project => project.id === projectId,
  );
  if (arrangerProject) {
    const serializedGqlField = serializeToGqlField(graphqlField);

    const extendedMapping = await createExtendedMapping(es)({
      esIndex,
      esType,
    });

    const metadataContent: IProjectIndexMetadata = {
      index: esIndex,
      name: serializedGqlField,
      esType: esType,
      timestamp: timestamp(),
      active: true,
      config: {
        'aggs-state': [],
        'columns-state': await createColumnSetState(es)({
          esIndex,
          esType,
        }),
        extended: extendedMapping,
      },
    };

    await es.create({
      ...getProjectMetadataEsLocation(projectId),
      id: esIndex,
      body: metadataContent,
      refresh: true,
    });

    return getProjectIndex(es)({
      projectId,
      graphqlField: serializedGqlField,
    });
  } else {
    throw new UserInputError(`no project with ID ${projectId} was found`);
  }
};

export const getProjectIndex = (es: Client) => async ({
  projectId,
  graphqlField,
}: IIndexQueryInput): Promise<IIndexGqlModel> => {
  try {
    const output = (await getProjectMetadata(es)(projectId)).find(
      ({ graphqlField: _graphqlField }) => graphqlField === _graphqlField,
    );
    return output;
  } catch {
    throw new UserInputError(
      `could not find index ${graphqlField} of project ${projectId}`,
    );
  }
};

export const removeProjectIndex = (es: Client) => async ({
  projectId,
  graphqlField,
}: IIndexRemovalMutationInput): Promise<IIndexGqlModel> => {
  try {
    const removedIndexMetadata = await getProjectIndex(es)({
      projectId,
      graphqlField,
    });
    await es.delete({
      ...getProjectMetadataEsLocation(projectId),
      id: removedIndexMetadata.esIndex as string,
    });
    return removedIndexMetadata;
  } catch (err) {
    throw new UserInputError(
      `could not remove index ${graphqlField} of project ${projectId}`,
    );
  }
};
