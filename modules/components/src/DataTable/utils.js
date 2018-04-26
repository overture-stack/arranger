import columnTypes from './columnTypes';
import { withProps } from 'recompose';
import { isNil } from 'lodash';

export function getSingleValue(data) {
  if (typeof data === 'object' && data) {
    return getSingleValue(Object.values(data)[0]);
  } else {
    return data;
  }
}

export function normalizeColumns(columns = [], customTypes) {
  const types = {
    ...columnTypes,
    ...customTypes,
  };
  return columns.map(function(column) {
    return {
      ...column,
      show: typeof column.show === 'boolean' ? column.show : true,
      Cell: column.Cell || types[column.type],
      hasCustomType: isNil(column.hasCustomType)
        ? !!(customTypes || {})[column.type]
        : column.hasCustomType,
      ...(!column.accessor && !column.id ? { id: column.field } : {}),
    };
  });
}

export const withNormalizedColumns = withProps(
  ({ config = {}, customTypes }) => ({
    config: {
      ...config,
      columns: normalizeColumns(config.columns, customTypes),
    },
  }),
);
