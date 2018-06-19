import { PassThrough } from 'stream';
import jsonPath from 'jsonpath';
import { cloneDeep } from 'lodash';
import { getProject } from './projects';

function getAllData({
  projectId,
  index,
  variables = null,
  chunkSize = 1000,
  fields = '',
  mock,
  sort = [],
}) {
  const stream = new PassThrough({ objectMode: true });
  const project = getProject(projectId);
  const sortWithId = sort.find(s => s.field === '_id')
    ? sort
    : [...sort, { field: '_id' }];

  project
    .runQuery({
      mock,
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
      stream.write({ data: null, total });
      const steps = Array(Math.ceil(total / chunkSize)).fill();

      return steps.reduce(async previous => {
        const searchAfter =
          jsonPath.query(
            (await previous) || {},
            `$["${index}"].hits.edges[-1:].searchAfter`,
          )[0] || null;
        const response = await project.runQuery({
          mock,
          query: `
            query ($sqon: JSON, $first: Int, $offset: Int, $sort: [Sort], $searchAfter: JSON) {
              ${index} {
                hits(first: $first, offset: $offset, filters: $sqon, sort: $sort, searchAfter: $searchAfter) {
                  edges {
                    searchAfter
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
            first: chunkSize,
            sort: sortWithId,
            searchAfter,
          },
        });

        // jsonPath checks the constructor and graphql is setting that to undefined. Cloning adds the constructor back
        const data = cloneDeep(response.data);

        stream.write({ data, total });

        return data;
      }, Promise.resolve());
    })
    .then(() => stream.end());
  return stream;
}

export default getAllData;
