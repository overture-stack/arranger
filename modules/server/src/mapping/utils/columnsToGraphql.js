export function toQuery(column) {
  return (
    column.query ||
    (column.accessor || '')
      .split('.')
      .reverse()
      .reduce((acc, segment, i, arr) => {
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

export default function columnsToGraphql({ config = {}, sqon, queryName, sort, offset, first }) {
  const fields = config.columns
    .filter(
      (column) =>
        !(column.accessor && column.accessor === config.keyFieldName) &&
        (column.fetch || column.show),
    )
    .concat(config.keyFieldName ? { accessor: config.keyFieldName } : [])
    .map(toQuery)
    .join('\n');

  return {
    fields,
    query: `
        query columnsToGraphql($sort: [Sort], $first: Int, $offset: Int, $score: String, $sqon: JSON) {
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
        sort.map((s) => {
          if (s.fieldName.indexOf('hits.total') >= 0) {
            return Object.assign({}, s, { fieldName: '_score' });
          } else {
            const nested = s.fieldName.match(/(.*)\.hits\.edges\[\d+\]\.node(.*)/);

            return Object.assign({}, s, nested ? { fieldName: `${nested[1]}${nested[2]}` } : {});
          }
        }),
      score:
        (sort &&
          sort
            .filter((s) => s.fieldName.indexOf('hits.total') >= 0)
            .map((s) => {
              const match = s.fieldName.match(/((.*)s)\.hits\.total/);
              return `${match[1]}.${match[2]}_id`;
            })
            .join(',')) ||
        null,
      offset,
      first,
    },
  };
}
