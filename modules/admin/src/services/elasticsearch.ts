import { Client } from 'elasticsearch';

export const createClient = (esHost: string) =>
  new Client({
    host: esHost,
    // log: 'trace',
  });

interface EsMapping {
  [key: string]: {
    mappings: {
      [key: string]: {
        properties: {
          [key: string]: any;
        };
      };
    };
  };
}

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
