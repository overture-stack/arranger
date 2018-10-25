import { Client } from 'elasticsearch';
import { extendMapping } from '@arranger/mapping-utils/dist';
import { getEsMapping } from '../../services/elasticsearch';
import { EsIndexLocation } from '../types';
import { getProjectStorageMetadata } from '../IndexSchema/utils';
import {
  I_ExtendedFieldsMappingsQueryArgs,
  I_GqlExtendedFieldMapping,
} from './types';

export const createExtendedMapping = (es: Client) => async ({
  esIndex,
  esType,
}: EsIndexLocation): Promise<Array<I_GqlExtendedFieldMapping>> => {
  let extendedMappings: Array<I_GqlExtendedFieldMapping> = [];
  try {
    const esMapping = await getEsMapping(es)({ esIndex, esType });
    const indexName = Object.keys(esMapping)[0]; //assumes all mappings returned are the same
    const esMappingProperties =
      esMapping[indexName].mappings[esType].properties;
    extendedMappings = extendMapping(esMappingProperties) as Array<
      I_GqlExtendedFieldMapping
    >;
  } catch (err) {
    console.log('error: ', err);
  }
  return extendedMappings;
};

export const getExtendedMapping = (es: Client) => async ({
  projectId,
  graphqlField,
  field,
}: I_ExtendedFieldsMappingsQueryArgs): Promise<
  Array<I_GqlExtendedFieldMapping>
> => {
  const indexMetadata = (await getProjectStorageMetadata(es)(projectId)).find(
    metaData => metaData.name === graphqlField,
  );

  if (indexMetadata) {
    if (field) {
      return indexMetadata.config.extended.filter(ex => field === ex.field);
    } else {
      return indexMetadata.config.extended;
    }
  } else {
    return null;
  }
};
