import { Resolver } from '../types';

enum E_ExtendedFieldType {
  boolean = 'boolean',
  byte = 'integer',
  date = 'date',
  double = 'double',
  float = 'float',
  half_float = 'float',
  id = 'id',
  integer = 'integer',
  keyword = 'keyword',
  long = 'long',
  nested = 'nested',
  object = 'object',
  scaled_float = 'float',
  string = 'string',
  text = 'text',
  unsigned_long = 'long',
}

enum E_NumericTypeUnit {
  angle = 'angle',
  apparentPower = 'apparentPower',
  area = 'area',
  current = 'current',
  digital = 'digital',
  each = 'each',
  energy = 'energy',
  frequency = 'frequency',
  illuminance = 'illuminance',
  length = 'length',
  mass = 'mass',
  pace = 'pace',
  partsPer = 'partsPer',
  power = 'power',
  pressure = 'pressure',
  reactiveEnergy = 'reactiveEnergy',
  reactivePower = 'reactivePower',
  speed = 'speed',
  temperature = 'temperature',
  time = 'time',
  voltage = 'voltage',
  volume = 'volume',
  volumeFlowRate = 'volumeFlowRate',
}

export interface I_GqlExtendedFieldMapping {
  gqlId: Resolver<string>;
  field: Resolver<string>;
  type: Resolver<E_ExtendedFieldType>;
  displayName: Resolver<string>;
  active: Resolver<boolean>;
  isArray: Resolver<boolean>;
  primaryKey: Resolver<boolean>;
  quickSearchEnabled: Resolver<boolean>;
  unit: Resolver<E_NumericTypeUnit>;
  displayValues: Resolver<{}>;
  rangeStep: Resolver<number>;
}

export interface I_ExtendedFieldMappingInput {
  type: E_ExtendedFieldType;
  displayName: string;
  active: boolean;
  isArray: boolean;
  primaryKey: boolean;
  quickSearchEnabled: boolean;
  unit: E_NumericTypeUnit;
  displayValues: {};
  rangeStep: number;
}

export interface I_ExtendedMappingSetFieldInput {
  gqlId: string;
  field: string;
  type: E_ExtendedFieldType;
  displayName: string;
  active: boolean;
  isArray: boolean;
  primaryKey: boolean;
  quickSearchEnabled: boolean;
  unit: E_NumericTypeUnit;
  displayValues: {};
  rangeStep: number;
}

export interface I_ExtendedFieldsMappingsQueryArgs {
  projectId: string;
  graphqlField: string;
  field?: string;
}

export interface I_UpdateExtendedMappingMutationArgs {
  projectId: string;
  graphqlField: string;
  field: string;
  extendedFieldMappingInput: I_ExtendedFieldMappingInput;
}

export interface I_SaveExtendedMappingMutationArgs {
  projectId: string;
  graphqlField: string;
  input: Array<I_ExtendedMappingSetFieldInput>;
}
