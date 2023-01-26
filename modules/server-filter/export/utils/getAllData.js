import {PassThrough} from 'stream';
import {buildQuery, esToSafeJsInt} from '@arranger/middleware';
import {DOWNLOAD_STREAM_BUFFER_SIZE} from '../../config.js';
import {graphql} from "graphql";
import {arrangerAuthFilterDownload} from './authFilterDownload.js';

export function runQuery ( { project_id, esClient, query, schema, variables }) {
    return graphql({
      schema,
      contextValue: {
          schema,
          es: esClient,
          projectId: project_id
      },
      source: query,
      variableValues: variables,
  })
}

export async function getAllData ({
                                      project_info,
                                      params,
                                      headers,
                                      index,
                                      columns = [],
                                      sort = [],
                                      sqon,
                                      chunkSize = DOWNLOAD_STREAM_BUFFER_SIZE,
                                      ...rest
                                  }) {

  const stream = new PassThrough({ objectMode: true });
  const toHits = ({
    body: {
      hits: { hits },
    },
  }) => hits;
  const esSort = sort.map(({ field, order }) => ({ [field]: order })).concat({ _id: 'asc' });

  const { esIndex, esType, extended } = await project_info.es
    .search({
      index: `arranger-projects-${project_info.projectId}`,
    })
    .then(toHits)
    .then((hits) => hits.map(({ _source }) => _source))
    .then(
      (hits) =>
        hits
          .map(({ index: esIndex, name, esType, config: { extended } }) => ({
            esIndex,
            name,
            esType,
            extended,
          }))
          .filter(({ name }) => name === index)[0],
    );

  const nestedFields = extended.filter(({ type }) => type === 'nested').map(({ field }) => field);

  const es_schema = project_info.arranger_schema['schema']
  sqon = arrangerAuthFilterDownload(params['project_code'], sqon, headers)
  const query = buildQuery({ nestedFields, filters: sqon });

  runQuery({
    project_id: project_info.projectId,
    esClient: project_info.es,
    query: `
        query ($sqon: JSON) {
          m1facetalias {
            hits(filters: $sqon) {
              total
            }
          }
        }
      `,
    schema: es_schema,
    variables: { sqon },
  })
    .then(({ data }) => {
      const total = data[index].hits.total;
      const steps = Array(Math.ceil(total / chunkSize)).fill();
      // async reduce because each cycle is dependent on result of the previous
      return steps.reduce(async (previous) => {
        const previousHits = await previous;
        const hits = await project_info.es
          .search({
            index: esIndex,
            size: chunkSize,
            body: {
              sort: esSort,
              ...(previousHits
                ? {
                    search_after: previousHits[previousHits.length - 1].sort.map(esToSafeJsInt),
                  }
                : {}),
              ...(Object.entries(query).length ? { query } : {}),
            },
          })
          .then(toHits);
        stream.write({ hits, total });
        return hits;
      }, Promise.resolve());
    })
    .then(() => stream.end())
    .catch(console.error);
  return stream;
}
