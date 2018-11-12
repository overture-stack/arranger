import { Resolver } from '../types';

enum E_ExtendedFieldType {
  string = 'string',
  object = 'object',
  text = 'text',
  boolean = 'boolean',
  date = 'date',
  keyword = 'keyword',
  id = 'id',
  long = 'long',
  double = 'double',
  integer = 'integer',
  float = 'float',
  nested = 'nested',
}

enum E_NumericTypeUnit {
  length = 'length',
  area = 'area',
  mass = 'mass',
  volume = 'volume',
  each = 'each',
  temperature = 'temperature',
  time = 'time',
  digital = 'digital',
  partsPer = 'partsPer',
  speed = 'speed',
  pace = 'pace',
  pressure = 'pressure',
  current = 'current',
  voltage = 'voltage',
  power = 'power',
  reactivePower = 'reactivePower',
  apparentPower = 'apparentPower',
  energy = 'energy',
  reactiveEnergy = 'reactiveEnergy',
  volumeFlowRate = 'volumeFlowRate',
  illuminance = 'illuminance',
  frequency = 'frequency',
  angle = 'angle',
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
