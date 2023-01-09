export function toQuery(column) {
  return (
    column.query ||
    (column.accessor || '')
      .split('.')
      .reverse()
      .reduce((acc, segment, i) => {
        if (i === 0) {
          return segment;
        } else {
          return `${segment.indexOf('edges[') === 0 ? 'edges' : segment} {
                ${acc}
              }`;
        }
      }, '')
  );
}

/**
 * @param {SQONType} [sqon] typescript validation placeholder
 */
export default function columnsToGraphql({
  config = {},
  documentType = 'unknownField',
  sqon = null,
  queryName = '',
  sort = [],
  offset = 0,
  first = 20,
}) {
  const fields = config?.columns
    ?.filter(
      (column) =>
        !(column.accessor && column.accessor === config.keyField) && (column.fetch || column.show),
    )
    .concat(config.keyField ? { accessor: config.keyField } : [])
    .map(toQuery)
    .join('\n');

  return {
    fields,
    query: `query ${queryName}($sort: [Sort], $first: Int, $offset: Int, $score: String, $sqon: JSON) {
      ${documentType} {
        hits(first: $first, offset: $offset, sort: $sort, score: $score, filters: $sqon) {
          total
          edges {
            node {
              ${fields}
            }
          }
        }
      }
    }`,
    variables: {
      sqon,
      sort: sort.map((s) => {
        if (s.field.indexOf('hits.total') >= 0) {
          return Object.assign({}, s, { field: '_score' });
        } else {
          const nested = s.field.match(/(.*)\.hits\.edges\[\d+\]\.node(.*)/);

          return Object.assign({}, s, nested ? { field: `${nested[1]}${nested[2]}` } : {});
        }
      }),
      score:
        sort.length > 0
          ? sort
              .filter((s) => s.field.indexOf('hits.total') >= 0)
              .map((s) => {
                const match = s.field.match(/((.*)s)\.hits\.total/);
                return `${match[1]}.${match[2]}_id`;
              })
              .join(',')
          : null,
      offset,
      first,
    },
  };
}
