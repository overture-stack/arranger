import { Client } from '@elastic/elasticsearch';
import { EsMapping } from './types';

export const createClient = (esHost: string, esUser: string, esPass: string) => {
  const esConf = { node: esHost };
  if (esUser && esPass) {
    esConf['auth'] = {
      username: esUser,
      password: esPass,
    };
  }
  return new Client(esConf);
};

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
