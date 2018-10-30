export enum EsTypes {
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

interface FieldMappingBase {
  type: EsTypes;
}

interface ScalarFieldMapping extends FieldMappingBase {
  type:
    | EsTypes.keyword
    | EsTypes.long
    | EsTypes.integer
    | EsTypes.short
    | EsTypes.byte
    | EsTypes.double
    | EsTypes.float
    | EsTypes.half_float
    | EsTypes.scaled_float
    | EsTypes.boolean
    | EsTypes.binary;
  fields?: {
    [key: string]: { [key: string]: {} };
  };
}

interface DateFieldMapping extends FieldMappingBase {
  type: EsTypes.date;
  format: string;
}

interface NestedFieldMapping extends FieldMappingBase {
  type: EsTypes.nested;
  properties: {
    [key: string]: EsFieldMapping;
  };
}

interface ObjectTypeMapping {
  [key: string]: ScalarFieldMapping;
}

type EsFieldMapping =
  | ObjectTypeMapping
  | NestedFieldMapping
  | DateFieldMapping
  | ScalarFieldMapping;

export interface EsMapping {
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
