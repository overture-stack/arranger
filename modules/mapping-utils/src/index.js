export { default as addMappingsToTypes } from './addMappingsToTypes';
export {
  default as createConnectionResolvers,
} from './createConnectionResolvers';
export { default as mappingToFields } from './mappingToFields';
export { default as mappingToAggsType } from './mappingToAggsType';
export { default as mappingToAggsState } from './mappingToAggsState';
export { default as esToAggTypeMap } from './esToAggTypeMap';
export { default as mappingToColumnsState } from './mappingToColumnsState';
export { default as mappingToNestedTypes } from './mappingToNestedTypes';
export { default as mappingToScalarFields } from './mappingToScalarFields';
export { default as getNestedFields } from './getNestedFields';
export { default as flattenMapping } from './flattenMapping';
export { default as extendFields } from './extendFields';
export {
  default as mappingToDisplayTreeData,
} from './mappingToDisplayTreeData';

export let esToGraphqlTypeMap = {
  keyword: 'String',
  string: 'String',
  text: 'String',
  date: 'String',
  boolean: 'Boolean',
  long: 'Float',
  double: 'Float',
  integer: 'Float',
  float: 'Float',
};
