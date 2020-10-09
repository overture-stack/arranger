import { parse } from 'date-fns';
import { groupBy, mapKeys } from 'lodash';
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

const mapState = (key, state) => {
  const source = state.map((x) => x._source);
  if (key === 'extended') {
    return source;
  } else if (['aggs-state', 'columns-state', 'matchbox-state'].includes(key)) {
    return source.sort((x, y) => parse(y.timestamp) - parse(x.timestamp))[0].state;
  } else {
    console.log(`[export] - WARNING - no import strategy for config state '${key}'`);
    return source;
  }
};

const jamTypeStateInPack = async ({ type, pack, id, es }) => {
  const indexPrefix = `arranger-projects-${id}`;

  let results;
  try {
    results = mapKeys(
      groupBy(
        await getAllResults({
          es,
          search: {
            index: `${indexPrefix}-${type}*`,
            size: 500,
            sort: ['_index:asc', '_id:asc'],
          },
        }),
        '_index',
      ),
      (_, k) => k.replace(`${indexPrefix}-`, ''),
    );
  } catch (err) {
    results = {};
  }

  await Promise.all(
    Object.keys(results)
      .map((key) => ({
        key,
        fileKey: key === type ? `extended` : key.replace(`${type}-`, ''),
      }))
      .map(
        ({ key, fileKey }) =>
          new Promise((res, rej) =>
            pack.entry(
              {
                name: `arranger-project-${id}/${type}/${fileKey}.json`,
              },
              JSON.stringify(mapState(fileKey, results[key]), null, 2),
              (err) => (err ? rej(err) : res()),
            ),
          ),
      ),
  );
};

export default async (req, res) => {
  let { es } = req.context;
  let { id } = req.params;

  if (!id) return res.json({ error: 'project empty' });

  const types = mapHits(await getTypes({ id, es })).map((x) => x.index);

  const pack = tar.pack();
  await Promise.all(types.map((type) => jamTypeStateInPack({ type, pack, id, es })));
  await pack.finalize();

  res.attachment(`arranger-project-${id}.tar.gz`);
  pack.pipe(zlib.createGzip()).pipe(res);
};
