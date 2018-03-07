import columnTypes from './columnTypes';
import { withProps } from 'recompose';

export function getSingleValue(data) {
  if (typeof data === 'object') {
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
      ...(column.jsonPath ? { id: column.field } : {}),
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
