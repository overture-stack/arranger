import { groupBy } from 'lodash';
import zlib from 'zlib';
import tar from 'tar-stream';

const getAllResults = async ({ es, search, results = [] }) => {
  const response = await es.search(search);
  const nextResults = [...results, ...response.hits.hits];
  return nextResults.length < response.hits.total
    ? await getAllResults({
        es,
        search: {
          ...search,
          body: { search_after: nextResults.slice(-1)[0].sort },
        },
        results: nextResults,
      })
    : nextResults;
};

export default async (req, res) => {
  let { es } = req.context;
  let { id } = req.params;

  if (!id) return res.json({ error: 'project empty' });

  id = id.toLowerCase();

  const results = groupBy(
    await getAllResults({
      es,
      search: {
        index: `arranger-projects-${id}*`,
        size: 500,
        sort: ['_index:asc', '_id:asc'],
      },
    }),
    '_index',
  );

  const pack = tar.pack();
  await Promise.all(
    Object.keys(results).map(
      k =>
        new Promise((res, rej) =>
          pack.entry(
            { name: `${k}.json` },
            JSON.stringify(results[k], null, 2),
            err => (err ? rej(err) : res()),
          ),
        ),
    ),
  );
  await pack.finalize();

  res.attachment(`arranger-project-${id}.tar.gz`);
  pack.pipe(zlib.createGzip()).pipe(res);
};
