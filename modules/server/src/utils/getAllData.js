import { PassThrough } from 'stream';
import { buildQuery, esToSafeJsInt } from '@kfarranger/middleware';
import { DOWNLOAD_STREAM_BUFFER_SIZE } from '../utils/config';
import { getProject } from './projects';

export default async ({
  projectId,
  es,
  index,
  columns = [],
  sort = [],
  sqon,
  chunkSize = DOWNLOAD_STREAM_BUFFER_SIZE,
  ...rest
}) => {
  const stream = new PassThrough({ objectMode: true });
  const toHits = ({ hits: { hits } }) => hits;
  const esSort = sort
    .map(({ field, order }) => ({ [field]: order }))
    .concat({ _id: 'asc' });

  const { esIndex, esType, extended } = await es
    .search({
      index: `arranger-projects-${projectId}`,
      type: `arranger-projects-${projectId}`,
    })
    .then(toHits)
    .then(hits => hits.map(({ _source }) => _source))
    .then(
      hits =>
        hits
          .map(({ index: esIndex, name, esType, config: { extended } }) => ({
            esIndex,
            name,
            esType,
            extended,
          }))
          .filter(({ name }) => name === index)[0],
    );

  const nestedFields = extended
    .filter(({ type }) => type === 'nested')
    .map(({ field }) => field);

  const query = buildQuery({ nestedFields, filters: sqon });

  getProject(projectId)
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
      variables: { sqon },
    })
    .then(({ data }) => {
      const total = data[index].hits.total;
      const steps = Array(Math.ceil(total / chunkSize)).fill();
      // async reduce because each cycle is dependent on result of the previous
      return steps.reduce(async previous => {
        const previousHits = await previous;
        console.time(`EsQuery`);
        const hits = await es
          .search({
            index: esIndex,
            type: esType,
            size: chunkSize,
            body: {
              sort: esSort,
              ...(previousHits
                ? {
                    search_after: previousHits[
                      previousHits.length - 1
                    ].sort.map(esToSafeJsInt),
                  }
                : {}),
              ...(Object.entries(query).length ? { query } : {}),
            },
          })
          .then(toHits);
        console.timeEnd(`EsQuery`);
        stream.write({ hits, total });
        return hits;
      }, Promise.resolve());
    })
    .then(() => stream.end())
    .catch(console.error);
  return stream;
};
