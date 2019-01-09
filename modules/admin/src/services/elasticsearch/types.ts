interface EsTypeKeys {
  keyword: string;
  long: string;
  integer: string;
  short: string;
  byte: string;
  double: string;
  float: string;
  half_float: string;
  scaled_float: string;
  date: string;
  boolean: string;
  binary: string;
  integer_range: string;
  float_range: string;
  long_range: string;
  double_range: string;
  date_range: string;
  object: string;
  nested: string;
  geo_point: string;
  geo_shape: string;
  ip: string;
  completion: string;
  token_count: string;
  murmur3: string;
  join: string;
}

export const esTypes: EsTypeKeys = {
  keyword: 'keyword',
  long: 'long',
  integer: 'integer',
  short: 'short',
  byte: 'byte',
  double: 'double',
  float: 'float',
  half_float: 'half_float',
  scaled_float: 'scaled_float',
  date: 'date',
  boolean: 'boolean',
  binary: 'binary',
  integer_range: 'integer_range',
  float_range: 'float_range',
  long_range: 'long_range',
  double_range: 'double_range',
  date_range: 'date_range',
  object: 'object',
  nested: 'nested',
  geo_point: 'geo_point',
  geo_shape: 'geo_shape',
  ip: 'ip',
  completion: 'completion',
  token_count: 'token_count',
  murmur3: 'murmur3',
  join: 'join',
};

export type EsTypes = keyof EsTypeKeys;

export interface FieldMappingBase {
  type: EsTypes;
}

export interface ScalarFieldMapping extends FieldMappingBase {
  type:
    | 'keyword'
    | 'long'
    | 'integer'
    | 'short'
    | 'byte'
    | 'double'
    | 'float'
    | 'half_float'
    | 'scaled_float'
    | 'boolean'
    | 'binary';
  fields?: {
    [key: string]: { [key: string]: {} };
  };
}

export interface DateFieldMapping extends FieldMappingBase {
  type: 'date';
  format: string;
}

export interface NestedFieldMapping extends FieldMappingBase {
  type: 'nested';
  properties: {
    [key: string]: EsFieldMapping;
  };
}

export interface ObjectTypeMapping {
  [key: string]: ScalarFieldMapping;
}

export type EsFieldMapping =
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
