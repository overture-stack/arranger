import { Client } from '@elastic/elasticsearch';
import { extendMapping } from '@arranger/mapping-utils';
import { getEsMapping } from '../../services/elasticsearch';
import { UserInputError } from 'apollo-server';
import { EsIndexLocation } from '../types';
import {
  getProjectStorageMetadata,
  updateProjectIndexMetadata,
} from '../IndexSchema/utils';
import {
  I_ExtendedFieldsMappingsQueryArgs,
  I_GqlExtendedFieldMapping,
  I_SaveExtendedMappingMutationArgs,
  I_UpdateExtendedMappingMutationArgs,
} from './types';
import { replaceBy } from '../../services';

export const createExtendedMapping = (es: Client) => async ({
  esIndex,
}: EsIndexLocation): Promise<I_GqlExtendedFieldMapping[]> => {
  let extendedMappings: I_GqlExtendedFieldMapping[] = [];
  try {
    const esMapping = await getEsMapping(es)({ esIndex });
    const indexName = Object.keys(esMapping)[0]; //assumes all mappings returned are the same
    const esMappingProperties = esMapping[indexName].mappings.properties;
    extendedMappings = extendMapping(
      esMappingProperties,
    ) as I_GqlExtendedFieldMapping[];
  } catch (err) {
    console.log('error: ', err);
    throw err;
  }
  return extendedMappings;
};

export const getExtendedMapping = (es: Client) => async ({
  projectId,
  graphqlField,
  field,
}: I_ExtendedFieldsMappingsQueryArgs): Promise<I_GqlExtendedFieldMapping[]> => {
  const assertOutputType = (i: any): I_GqlExtendedFieldMapping => ({
    gqlId: `${projectId}::${graphqlField}::extended::${i.field}`,
    field: i.field,
    type: i.type,
    displayName: i.displayName,
    active: i.active,
    isArray: i.isArray,
    primaryKey: i.primaryKey,
    quickSearchEnabled: i.quickSearchEnabled,
    unit: i.unit,
    displayValues: i.displayValues,
    rangeStep: i.rangeStep,
  });
  const indexMetadata = (await getProjectStorageMetadata(es)(projectId)).find(
    metaData => metaData.name === graphqlField,
  );
  if (indexMetadata) {
    if (field) {
      return indexMetadata.config.extended
        .filter(ex => field === ex.field)
        .map(assertOutputType);
    } else {
      return indexMetadata.config.extended.map(assertOutputType);
    }
  } else {
    throw new UserInputError(
      `no index found under name ${graphqlField} for project ${projectId}`,
    );
  }
};

export const updateFieldExtendedMapping = (es: Client) => async ({
  field: mutatedField,
  graphqlField,
  projectId,
  extendedFieldMappingInput,
}: I_UpdateExtendedMappingMutationArgs): Promise<I_GqlExtendedFieldMapping> => {
  const currentIndexMetadata = (
    await getProjectStorageMetadata(es)(projectId)
  ).find(metaData => {
    return metaData.name === graphqlField;
  });

  if (currentIndexMetadata) {
    const indexExtendedMappingFields = await getExtendedMapping(es)({
      projectId,
      graphqlField,
    });

    const newIndexExtendedMappingFields: I_GqlExtendedFieldMapping[] = indexExtendedMappingFields.map(
      field =>
        (field.field as string) === mutatedField
          ? { ...field, ...extendedFieldMappingInput }
          : field,
    );

    await updateProjectIndexMetadata(es)({
      projectId,
      metaData: {
        index: currentIndexMetadata.index,
        name: currentIndexMetadata.name,
        config: {
          extended: newIndexExtendedMappingFields,
        },
      },
    });

    return newIndexExtendedMappingFields.find(
      field => field.field === mutatedField,
    );
  } else {
    throw new UserInputError(
      `no index found under name ${graphqlField} for project ${projectId}`,
    );
  }
};

export const saveExtendedMapping = (es: Client) => async (
  args: I_SaveExtendedMappingMutationArgs,
): Promise<I_GqlExtendedFieldMapping[]> => {
  const { projectId, graphqlField, input } = args;
  const currentIndexMetadata = (
    await getProjectStorageMetadata(es)(projectId)
  ).find(entry => entry.name === graphqlField);
  const {
    config: { extended: currentStoredExtendedMapping },
  } = currentIndexMetadata;

  const newExtendedMapping: I_GqlExtendedFieldMapping[] = replaceBy(
    currentStoredExtendedMapping,
    input,
    (el1, el2) => el1.field === el2.field,
  );

  await updateProjectIndexMetadata(es)({
    projectId,
    metaData: {
      index: currentIndexMetadata.index,
      name: currentIndexMetadata.name,
      config: {
        extended: newExtendedMapping,
      },
    },
  });

  return newExtendedMapping;
};
