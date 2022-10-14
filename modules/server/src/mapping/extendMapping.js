import { startCase } from 'lodash';

import flattenMapping from './flattenMapping';

export const extendColumns = (tableConfig = {}, extendedFromFile = []) => ({
  ...tableConfig,
  columns: tableConfig?.columns?.map((column) => {
    const fieldObj = extendedFromFile?.find((obj) => obj.field === column?.field);

    return {
      ...column,
      accessor: column.accessor ?? column.field,
      displayName: column.displayName ?? fieldObj?.displayName ?? '* ' + column.field,
      displayValues: column.displayValues ?? fieldObj?.displayValues ?? {},
      isArray: fieldObj?.isArray ?? false,
      type: column?.type ?? fieldObj?.displayType ?? fieldObj?.type,
    };
  }),
});

export const extendFields = (mappingFields, extendedFromFile) => {
  return flattenMapping(mappingFields)?.map(({ field = '', type = '', ...rest }) => {
    const {
      active = false,
      displayName = startCase(field.replace(/\./g, ' ')),
      displayValues = {},
      isArray = false,
      primaryKey = false,
      quickSearchEnabled = false,
      rangeStep = type === 'float' || type === 'double' ? 0.01 : 1,
      type: displayType = 'keyword',
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
