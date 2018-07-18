import express from 'express';
import zlib from 'zlib';
import bodyParser from 'body-parser';
import tar from 'tar-stream';
import { defaults } from 'lodash';
import columnsToGraphql from '@arranger/mapping-utils/dist/utils/columnsToGraphql';

import getAllData from '../utils/getAllData';
import dataToTSV from '../utils/dataToTSV';
import { DOWNLOAD_STREAM_BUFFER_SIZE } from '../utils/config';

const DOWNLOAD_STREAM_BUFFER_SIZE = 2000;

export default function({ projectId, io }) {
  function makeTSV(args) {
    return getAllData({
      chunkSize: DOWNLOAD_STREAM_BUFFER_SIZE,
      projectId,
      ...args,
      ...columnsToGraphql({
        sqon: args.sqon,
        config: { columns: args.columns, type: args.index },
        sort: args.sort || [],
        first: DOWNLOAD_STREAM_BUFFER_SIZE,
      }),
    }).pipe(dataToTSV(args));
  }

  function multipleFiles({ files, mock, chunkSize }) {
    const pack = tar.pack();

    Promise.all(
      files.map((file, i) => {
        return new Promise((resolve, reject) => {
          // pack needs the size of the stream. We don't know that until we get all the data. This collects all the data before adding it.
          let data = '';
          const fileStream = makeTSV(defaults(file, { mock, chunkSize }));
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
        responseFileName = files[0].fileName || 'file.tsv';
        contentType = 'text/plain';
      } else {
        output = multipleFiles({ files, mock, chunkSize });
        responseFileName = fileName.replace(/(\.tar(\.gz)?)?$/, '.tar.gz'); // make sure file ends with '.tar.gz'
        contentType = 'application/gzip';
      }

      res.set('Content-Type', contentType);
      res.set(
        'Content-disposition',
        `attachment; filename=${responseFileName}`,
      );
      output.pipe(res).on('finish', () => {
        console.timeEnd('download');
        io.emit(`server::download::${downloadKey}`);
      });
    }
  });

  return router;
}
