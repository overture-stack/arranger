import { get } from 'lodash';

export default (config, { queryName, sort, offset, first }) => {
  const API = 'http://localhost:5050';

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

  return fetch(`${API}/${queryName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        query($sort: [Sort], $first: Int, $offset: Int, $score: String) {
          ${config.type} {
            hits(first: $first, offset: $offset, sort: $sort, score: $score) {
              total
              edges {
                node {
                  ${config.columns
                    .filter(
                      column =>
                        column.fetch ||
                        column.show ||
                        column.accessor === config.keyField,
                    )
                    .map(toQuery)
                    .join('\n')}
                }
              }
            }
          }
        }
      `,
      variables: {
        sort:
          sort &&
          sort.map(s => {
            if (s.field.indexOf('hits.total') >= 0) {
              return {
                ...s,
                field: '_score',
              };
            } else {
              const nested = s.field.match(
                /(.*)\.hits\.edges\[\d+\]\.node(.*)/,
              );

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
          sort &&
          sort
            .filter(s => s.field.indexOf('hits.total') >= 0)
            .map(s => {
              const match = s.field.match(/((.*)s)\.hits\.total/);
              return `${match[1]}.${match[2]}_id`;
            })
            .join(','),
        offset,
        first,
      },
    }),
  }).then(r => r.json());
};
