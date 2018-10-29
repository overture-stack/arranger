import { Client } from 'elasticsearch';

export const createClient = (esHost: string) =>
  new Client({
    host: esHost,
    // log: 'trace',
  });

enum EsTypes {
  keyword = 'keyword',
  long = 'long',
  integer = 'integer',
  short = 'short',
  byte = 'byte',
  double = 'double',
  float = 'float',
  half_float = 'half_float',
  scaled_float = 'scaled_float',
  date = 'date',
  boolean = 'boolean',
  binary = 'binary',
  integer_range = 'integer_range',
  float_range = 'float_range',
  long_range = 'long_range',
  double_range = 'double_range',
  date_range = 'date_range',
  object = 'object',
  nested = 'nested',
  geo_point = 'geo_point',
  geo_shape = 'geo_shape',
  ip = 'ip',
  completion = 'completion',
  token_count = 'token_count',
  murmur3 = 'murmur3',
  join = 'join',
}

interface EsFieldMapping {
  type: EsTypes;
  fields?: {
    [key: string]: EsFieldMapping;
  };
  properties?: {
    [key: string]: EsFieldMapping;
  };
}

interface EsMapping {
  [key: string]: {
    mappings: {
      [key: string]: {
        _meta?: {
          [key: string]: any;
        };
        properties: {
          [key: string]: EsFieldMapping;
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
