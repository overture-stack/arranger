import { PassThrough } from 'stream';

import { getProject } from './projects';

function getAllData({
  projectId,
  index,
  variables = null,
  size = 100,
  fields = '',
}) {
  const stream = new PassThrough({ objectMode: true });
  const project = getProject(projectId);

  project
    .runQuery({
      query: `
        query ($sqon: JSON) {
          ${index} {
            hits(filters: $sqon) {
              total
            }
          }
        }
      `,
      variables,
    })
    .then(({ data }) => {
      const total = data[index].hits.total;
      const steps = Array(Math.ceil(total / size)).fill();

      return Promise.all(
        steps.map((x, i) => {
          return project
            .runQuery({
              query: `
              query ($sqon: JSON, $first: Int, $offset: Int) {
                ${index} {
                  hits(first: $first, offset: $offset, filters: $sqon) {
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
                ...variables,
                first: size,
                offset: i * size,
              },
            })
            .then(({ data }) => stream.write({ data, total }));
        }),
      );
    })
    .then(() => stream.end());

  return stream;
}

export default getAllData;
