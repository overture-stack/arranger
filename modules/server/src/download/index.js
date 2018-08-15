import { PassThrough } from 'stream';
import express from 'express';
import zlib from 'zlib';
import bodyParser from 'body-parser';
import tar from 'tar-stream';
import { defaults, get, isEqual } from 'lodash';
import columnsToGraphql from '@arranger/mapping-utils/dist/utils/columnsToGraphql';
import { buildQuery } from '@arranger/middleware';
import through2 from 'through2';

import getAllData from '../utils/getAllData';
import dataToTSV from '../utils/dataToTSV';
import { getProject } from '../utils/projects';
import { DOWNLOAD_STREAM_BUFFER_SIZE } from '../utils/config';
import esHitsToTsv from './esHitsToTsv';

export default function({ projectId, io }) {
  const makeTsvWithEsData = async ({
    es,
    index,
    columns,
    sort,
    sqon,
    chunkSize = DOWNLOAD_STREAM_BUFFER_SIZE,
    ...rest
  }) => {
    const stream = new PassThrough({ objectMode: true });
    const toHits = ({ hits: { hits } }) => hits;
    const esSort = sort.map(({ field, order }) => ({ [field]: order }));

    const { esIndex, name, esType, extended } = await es
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
                      search_after: previousHits[previousHits.length - 1].sort,
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

  const makeTSV = args => {
    return getAllData({
      projectId,
      ...args,
      ...columnsToGraphql({
        sqon: args.sqon,
        config: { columns: args.columns, type: args.index },
        sort: args.sort || [],
        first: DOWNLOAD_STREAM_BUFFER_SIZE,
      }),
      chunkSize: DOWNLOAD_STREAM_BUFFER_SIZE,
    }).pipe(dataToTSV(args));
  };

  function multipleFiles({ files, mock, chunkSize, es }) {
    const pack = tar.pack();

    Promise.all(
      files.map((file, i) => {
        return new Promise((resolve, reject) => {
          // pack needs the size of the stream. We don't know that until we get all the data. This collects all the data before adding it.
          let data = '';
          const makeTsvArgs = defaults(file, { mock, chunkSize });
          const fileStream = makeTSV(makeTsvArgs);
          const newFileStream = makeTsvWithEsData({ es, ...makeTsvArgs });
          fileStream.on('data', chunk => (data += chunk));
          fileStream.on('end', () => {
            pack.entry(
              { name: file.fileName || `file-${i + 1}.tsv` },
              data,
              function(err) {
                if (err) {
                  reject(err);
                } else {
                  resolve();
                }
              },
            );
          });
        });
      }),
    ).then(() => pack.finalize());

    return pack.pipe(zlib.createGzip());
  }

  const router = express.Router();

  router.use(bodyParser.urlencoded({ extended: true }));

  router.post('/', async function(req, res) {
    console.time('download');
    const es = req.context.es;
    const { params, downloadKey } = req.body;
    const { files, fileName = 'file.tar.gz', mock, chunkSize } = JSON.parse(
      params,
    );
    if (!files || !files.length) {
      console.warn('no files defined to download');
      res.status(400).send('files array was missing or empty');
    } else {
      let output;
      let responseFileName;
      let contentType;

      if (files.length === 1) {
        const makeTsvArgs = defaults(files[0], { mock, chunkSize });
        output = makeTSV(makeTsvArgs);
        const newFileStream = (await makeTsvWithEsData({
          ...makeTsvArgs,
          es,
        })).pipe(esHitsToTsv(makeTsvArgs));
        output = newFileStream;

        responseFileName = files[0].fileName || 'file.tsv';
        contentType = 'text/plain';
      } else {
        output = multipleFiles({ files, mock, chunkSize, es });
        responseFileName = fileName.replace(/(\.tar(\.gz)?)?$/, '.tar.gz'); // make sure file ends with '.tar.gz'
        contentType = 'application/gzip';
      }

      res.set('Content-Type', contentType);
      res.set(
        'Content-disposition',
        `attachment; filename=${responseFileName}`,
      );
      output.pipe(res).on('finish', () => {
        io.emit(`server::download::${downloadKey}`);
        console.timeEnd('download');
      });
    }
  });

  return router;
}
