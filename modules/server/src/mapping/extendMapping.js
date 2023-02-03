import { startCase } from 'lodash';

import flattenMapping from './flattenMapping';

export const extendColumns = (tableConfig = {}, extendedFields = []) => ({
  ...tableConfig,
  columns: tableConfig?.columns?.map((column) => {
    const fieldObj = extendedFields?.find((obj) => obj.fieldName === column?.fieldName);

    return {
      ...column,
      accessor: column.accessor ?? column.fieldName,
      displayName: column.displayName ?? fieldObj?.displayName ?? '* ' + column.fieldName,
      displayValues: column.displayValues ?? fieldObj?.displayValues ?? {},
      isArray: fieldObj?.isArray ?? false,
      type: column?.type ?? fieldObj?.displayType ?? fieldObj?.type,
    };
  }),
});

export const extendFields = (mappingFields, extendedFromFile) => {
  return flattenMapping(mappingFields)?.map(
    ({ field: fieldName = '', type: typeFromMapping = 'keyword', ...rest }) => {
      const {
        active = false,
        displayName = startCase(fieldName.replace(/\./g, ' ')),
        displayType = typeFromMapping,
        displayValues = {},
        isArray = false,
        primaryKey = false,
        quickSearchEnabled = false,
        rangeStep = typeFromMapping === 'float' || typeFromMapping === 'double' ? 0.01 : 1,
        type = typeFromMapping,
        unit = null,
      } = extendedFromFile.find((customData) => customData.fieldName === fieldName) || {};

      return {
        active,
        displayName,
        displayType,
        displayValues,
        fieldName,
        isArray,
        primaryKey,
        quickSearchEnabled,
        rangeStep,
        type,
        unit,
        ...rest,
      };
    },
  );
};

export default (mapping) => extendFields(flattenMapping(mapping));
