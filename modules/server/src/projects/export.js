import { groupBy } from 'lodash';
import zlib from 'zlib';
import tar from 'tar-stream';

import getTypes from '../utils/getTypes';
import mapHits from '../utils/mapHits';

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

const jamTypeStateInPack = async ({ type, pack, id, es }) => {
  const indexPrefix = `arranger-projects-${id}`;
  const fileName = ({ key, typeKey = key.replace(`${indexPrefix}-`, '') }) =>
    typeKey === type ? `extended` : typeKey.replace(`${type}-`, '');

  let results;
  try {
    results = groupBy(
      await getAllResults({
        es,
        search: {
          index: `${indexPrefix}-${type}*`,
          size: 500,
          sort: ['_index:asc', '_id:asc'],
        },
      }),
      '_index',
    );
  } catch (err) {
    results = {};
  }

  await Promise.all(
    Object.keys(results).map(
      key =>
        new Promise((res, rej) =>
          pack.entry(
            {
              name: `arranger-project-${id}/${type}/${fileName({
                key,
              })}.json`,
            },
            JSON.stringify(results[key], null, 2),
            err => (err ? rej(err) : res()),
          ),
        ),
    ),
  );
};

export default async (req, res) => {
  let { es } = req.context;
  let { id } = req.params;

  if (!id) return res.json({ error: 'project empty' });

  const types = mapHits(await getTypes({ id, es })).map(x => x.index);

  const pack = tar.pack();
  await Promise.all(
    types.map(type => jamTypeStateInPack({ type, pack, id, es })),
  );
  await pack.finalize();

  res.attachment(`arranger-project-${id}.tar.gz`);
  pack.pipe(zlib.createGzip()).pipe(res);
};
