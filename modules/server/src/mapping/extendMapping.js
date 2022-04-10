import { startCase } from 'lodash';

import flattenMapping from './flattenMapping';

export const extendColumns = (columnState = {}, extendedFields = []) => ({
  ...columnState,
  columns: columnState?.columns.map((column) => {
    const fieldObj = extendedFields.find((obj) => obj.field === column?.field);

    return {
      ...column,
      displayValues: fieldObj?.displayValues ?? {},
      header: fieldObj?.displayName ?? '* ' + column.field,
      isArray: fieldObj?.isArray ?? false,
      type: fieldObj?.displayType ?? fieldObj?.type,
    };
  }),
});

export const extendFields = (mappingFields, extendedFromFile) => {
  return flattenMapping(mappingFields).map(({ field = '', type = '', ...rest }) => {
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
