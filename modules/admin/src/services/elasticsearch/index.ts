import { Client } from '@elastic/elasticsearch';
import { EsMapping } from './types';

export const createClient = (esHost: string) =>
  new Client({
    node: esHost,
  });

export const getEsMapping = (es: Client) => async ({
  esIndex,
}: {
  esIndex: string;
  esType?: string; //deprecated
}): Promise<EsMapping> => {
  const response = await es.indices.getMapping({
    index: esIndex,
  });
  return response.body as EsMapping;
};
