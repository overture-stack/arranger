import { PassThrough } from 'stream';
import express from 'express';
import zlib from 'zlib';
import bodyParser from 'body-parser';
import tar from 'tar-stream';
import { defaults, take } from 'lodash';
import columnsToGraphql from '@arranger/mapping-utils/dist/utils/columnsToGraphql';

import getAllData from '../utils/getAllData';
import dataToTSV from '../utils/dataToTSV';
import { getProject } from '../utils/projects';
import { DOWNLOAD_STREAM_BUFFER_SIZE } from '../utils/config';

export default function({ projectId, io }) {
  const makeTsvWithEsData = ({
    es,
    file: { index, columns, sort, sqon, ...restFile },
    chunkSize = DOWNLOAD_STREAM_BUFFER_SIZE,
    ...rest
  }) => {
    const stream = new PassThrough({ objectMode: true });
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
        return es
          .search({
            index: `arranger-projects-${projectId}`,
            type: `arranger-projects-${projectId}`,
          })
          .then(({ hits: { hits } }) => hits.map(({ _source }) => _source))
          .then(
            hits =>
              hits
                .map(({ index, name, esType }) => ({
                  index,
                  name,
                  esType,
                }))
                .filter(({ name }) => name === index)[0],
          )
          .then(({ index: esIndex, name, esType } = {}) =>
            es.search({
              index: esIndex,
              type: esType,
              size: DOWNLOAD_STREAM_BUFFER_SIZE,
            }),
          )
          .then(({ hits: { hits } }) => hits.map(({ _source }) => _source));
      })
      .then(console.log)
      .catch(console.error);
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
          const fileStream = makeTSV(defaults(file, { mock, chunkSize }));
          const newFileStream = makeTsvWithEsData({
            es,
            file,
            mock,
            chunkSize,
          });
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
        output = makeTSV(defaults(files[0], { mock, chunkSize }));
        const newFileStream = makeTsvWithEsData({
          es,
          file: files[0],
          mock,
          chunkSize,
        });
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
      });
    }
  });

  return router;
}
