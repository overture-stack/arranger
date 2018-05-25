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

export function normalizeColumns({
  columns = [],
  customTypes,
  customColumns = [],
}) {
  const types = {
    ...columnTypes,
    ...customTypes,
  };
  const mappedColumns = columns
    .map(column => ({
      ...column,
      show: typeof column.show === 'boolean' ? column.show : true,
      Cell: column.Cell || types[column.type],
      hasCustomType: isNil(column.hasCustomType)
        ? !!(customTypes || {})[column.type]
        : column.hasCustomType,
      ...(!column.accessor && !column.id ? { id: column.field } : {}),
    }))
    .filter(x => x.show || x.canChangeShow);
  return customColumns.reduce(
    (arr, { index, content }) => [
      ...arr.slice(0, index),
      content,
      ...arr.slice(index),
    ],
    mappedColumns,
  );
}

export const withNormalizedColumns = withProps(
  ({ config = {}, customTypes, customColumns }) => ({
    config: {
      ...config,
      columns: normalizeColumns({
        columns: config.columns,
        customTypes,
        customColumns,
      }),
    },
  }),
);
