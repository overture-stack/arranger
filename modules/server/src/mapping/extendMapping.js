import { startCase } from 'lodash';

import flattenMapping from './flattenMapping';

export const extendFields = (mappingFields, extendedFromFile) => {
  return flattenMapping(mappingFields).map(({ field = '', type = '', ...rest }, index) => {
    const {
      active = false,
      displayName = startCase(field.replace(/\./g, ' ')),
      displayValues = {},
      isArray = false,
      primaryKey = false,
      quickSearchEnabled = false,
      rangeStep = type === 'float' || type === 'double' ? 0.01 : 1,
      type: displayType,
      unit = null,
    } = extendedFromFile.find((customData) => customData.field === field) || {};

    return {
      active,
      displayName,
      displayType,
      displayValues,
      field,
      isArray,
      primaryKey,
      quickSearchEnabled,
      rangeStep,
      type,
      unit,
      ...rest,
    };
  });
};

export default (mapping) => extendFields(flattenMapping(mapping));
