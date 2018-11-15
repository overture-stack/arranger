import express from 'express';
import zlib from 'zlib';
import bodyParser from 'body-parser';
import tar from 'tar-stream';
import { defaults } from 'lodash';

import getAllData from '../utils/getAllData';
import dataToTSV from '../utils/dataToTSV';

export default function({ projectId }) {
  const router = express.Router();

  router.use(bodyParser.urlencoded({ extended: true }));

  router.post('/', async function(req, res) {
    const es = req.context.es;
    const { params } = req.body;
    console.time('download');
    const { output, responseFileName, contentType } = await dataStream({
      es,
      projectId,
      params,
    });
    res.set('Content-Type', contentType);
    res.set('Content-disposition', `attachment; filename=${responseFileName}`);
    output.pipe(res).on('finish', () => {
      console.timeEnd('download');
    });
  });

  return router;
}

export const dataStream = async ({
  es,
  projectId,
  params,
  fileType = 'tsv',
}) => {
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
      output = await getFileStream({
        es,
        projectId,
        mock,
        chunkSize,
        file: files[0],
        fileType: files[0].fileType || fileType,
      });
      responseFileName = files[0].fileName;
      contentType = 'text/plain';
    } else {
      output = multipleFiles({ files, projectId, mock, chunkSize, es });
      responseFileName = fileName.replace(/(\.tar(\.gz)?)?$/, '.tar.gz'); // make sure file ends with '.tar.gz'
      contentType = 'application/gzip';
    }

    return { output, responseFileName, contentType };
  }
};

const multipleFiles = async ({ files, projectId, mock, chunkSize, es }) => {
  const pack = tar.pack();

  Promise.all(
    files.map((file, i) => {
      return new Promise(async (resolve, reject) => {
        // pack needs the size of the stream. We don't know that until we get all the data. This collects all the data before adding it.
        let data = '';
        const fileStream = await getFileStream({
          es,
          projectId,
          mock,
          chunkSize,
          file,
          fileType: file.fileType,
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
};

const getFileStream = async ({
  es,
  projectId,
  mock,
  chunkSize,
  file,
  fileType = 'tsv',
}) => {
  const makeTsvArgs = defaults(file, { mock, chunkSize, fileType });
  return makeTSV({ es, projectId })(makeTsvArgs);
};

const makeTSV = ({ es, projectId }) => async args =>
  (await getAllData({
    projectId,
    es,
    ...args,
  })).pipe(dataToTSV(args));
