import { PassThrough } from 'stream';

import { mapHits } from '../mapping';
import { buildQuery, esToSafeJsInt } from '../middleware';
import { CONFIG } from '../config';
import runQuery from './runQuery';

export default async ({
  chunkSize = CONFIG.DOWNLOAD_STREAM_BUFFER_SIZE,
  columns = [],
  ctx = {},
  mock,
  sort = [],
  sqon,
  ...rest
}) => {
  const { configs, esClient, mockSchema, schema } = ctx;

  const stream = new PassThrough({ objectMode: true });
  const esSort = sort.map(({ field, order }) => ({ [field]: order })).concat({ _id: 'asc' });

  const nestedFields = configs.extendedFields
    .filter(({ type }) => type === 'nested')
    .map(({ field }) => field);

  const query = buildQuery({ nestedFields, filters: sqon });

  runQuery({
    esClient,
    query: `
        query ($sqon: JSON) {
          ${configs.name} {
            hits(filters: $sqon) {
              total
            }
          }
        }
      `,
    schema: mock ? mockSchema : schema,
    variables: { sqon },
  })
    .then(({ data }) => {
      const total = data?.[configs.name]?.hits?.total || 0;
      const steps = Array(Math.ceil(total / Number(chunkSize))).fill(null);

      // async reduce because each cycle is dependent on result of the previous
      return steps.reduce(async (previous, next, stepNumber) => {
        const previousHits = await previous;
        const timerLabel = `EsQuery, step ${stepNumber + 1}`;

        console.time(timerLabel);
        const hits = await esClient
          .search({
            index: configs.index,
            size: chunkSize,
            body: {
              sort: esSort,
              ...(previousHits
                ? {
                    search_after: previousHits[previousHits.length - 1]?.sort?.map(esToSafeJsInt),
                  }
                : {}),
              ...(Object.entries(query).length ? { query } : {}),
            },
          })
          .then(({ body }) => mapHits(body));
        console.timeEnd(timerLabel);

        stream.write({ hits, total });

        return hits;
      }, Promise.resolve());
    })
    .then(() => stream.end())
    .catch(console.error);

  return stream;
};
