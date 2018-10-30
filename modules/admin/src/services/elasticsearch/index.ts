import { Client } from 'elasticsearch';
import { EsMapping } from './types';

export const createClient = (esHost: string) =>
  new Client({
    host: esHost,
    // log: 'trace',
  });

export const getEsMapping = (es: Client) => async ({
  esIndex,
  esType,
}: {
  esIndex: string;
  esType: string;
}): Promise<EsMapping> => {
  const response = await es.indices.getMapping({
    index: esIndex,
    type: esType,
  });
  return response;
};
