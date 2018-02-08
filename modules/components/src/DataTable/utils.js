import { get } from 'lodash';
import columnTypes from './columnTypes';
import { withProps } from 'recompose';

export function getSingleValue(data) {
  if (typeof data === 'object') {
    return getSingleValue(Object.values(data)[0]);
  } else {
    return data;
  }
}

export function columnsToGraphql({
  config = {},
  sqon,
  queryName,
  sort,
  offset,
  first,
}) {
  function toQuery(column) {
    return (
      column.query ||
      column.accessor
        .split('.')
        .reverse()
        .reduce((acc, segment, i, arr) => {
          if (segment === 'hits') {
            const first = get(arr[i - 1].match(/edges\[(\d+)\]/), '[1]', 0);
            return `${segment}(first: ${first}) {
                ${acc}
              }`;
          } else if (i === 0) {
            return segment;
          } else {
            return `${segment.indexOf('edges[') === 0 ? 'edges' : segment} {
                ${acc}
              }`;
          }
        }, '')
    );
  }

  const fields = config.columns
    .filter(
      column =>
        !(column.accessor && column.accessor === config.keyField) &&
        (column.fetch || column.show),
    )
    .concat(config.keyField ? { accessor: config.keyField } : [])
    .map(toQuery)
    .join('\n');

  return {
    fields,
    query: `
      query($sort: [Sort], $first: Int, $offset: Int, $score: String, $sqon: JSON) {
        ${config.type} {
          hits(first: $first, offset: $offset, sort: $sort, score: $score, filters: $sqon) {
            total
            edges {
              node {
                ${fields}
              }
            }
          }
        }
      }
    `,
    variables: {
      sqon: sqon || null,
      sort:
        sort &&
        sort.map(s => {
          if (s.field.indexOf('hits.total') >= 0) {
            return {
              ...s,
              field: '_score',
            };
          } else {
            const nested = s.field.match(/(.*)\.hits\.edges\[\d+\]\.node(.*)/);

            return {
              ...s,
              missing: 'first',
              ...(nested
                ? {
                    field: `${nested[1]}${nested[2]}`,
                  }
                : {}),
            };
          }
        }),
      score:
        (sort &&
          sort
            .filter(s => s.field.indexOf('hits.total') >= 0)
            .map(s => {
              const match = s.field.match(/((.*)s)\.hits\.total/);
              return `${match[1]}.${match[2]}_id`;
            })
            .join(',')) ||
        null,
      offset,
      first,
    },
  };
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
