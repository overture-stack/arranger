import express from 'express';
import zlib from 'zlib';
import tar from 'tar-stream';
import pkg from 'lodash';
const { defaults } = pkg;

import { getAllData } from './utils/getAllData.js';
import { dataToExportFormat } from './utils/dataToExportFormat.js';

const convertDataToExportFormat = ({ project_info, params, headers, ctx, fileType }) => async (
  args,
) =>
  (
    await getAllData({
      project_info,
      params,
      headers,
      ctx,
      ...args,
    })
  ).pipe(dataToExportFormat({ ...args, fileType }));

const getFileStream = async ({
  project_info,
  params,
  headers,
  chunkSize,
  ctx,
  file,
  fileType,
  mock,
}) => {
  const exportArgs = defaults(file, { chunkSize, fileType, mock });

  return convertDataToExportFormat({ project_info, params, headers, ctx, fileType })({
    ...exportArgs,
    mock,
  });
};

const multipleFiles = async ({ project_info, params, headers, chunkSize, ctx, files, mock }) => {
  const pack = tar.pack();

  Promise.all(
    files.map((file, i) => {
      return new Promise(async (resolve, reject) => {
        // pack needs the size of the stream. We don't know that until we get all the data.
        // This collects all the data before adding it.
        let data = '';
        const fileStream = await getFileStream({
          project_info,
          params,
          headers,
          chunkSize,
          ctx,
          file,
          fileType: file.fileType,
          mock,
        });

        fileStream.on('data', (chunk) => (data += chunk));
        fileStream.on('end', () => {
          pack.entry({ name: file.fileName || `file-${i + 1}.tsv` }, data, function (err) {
            if (err) {
              reject(err);
            } else {
              resolve(null);
            }
          });
        });
      });
    }),
  ).then(() => pack.finalize());

  /** NOTE from zlib's maintainers:
   * (This library) is only intended for small (< 128 KB) data
   * that you already have buffered. It is not meant for input/output streams.
   * -- Found at: https://www.npmjs.com/package/zlib
   *
   * TODO: may have to find one that manages larger buffer sizes.
   * Must do testing for this
   */
  return pack.pipe(zlib.createGzip());
};

export const dataStream = async ({ project_info, headers, ctx, params }) => {
  const { chunkSize, files, fileName = 'file.tar.gz', fileType = 'tsv', mock } = params;

  if (files?.length > 0) {
    return files.length === 1
      ? {
          contentType: 'text/plain',
          output: await getFileStream({
            project_info,
            params,
            headers,
            chunkSize,
            ctx,
            file: files[0],
            fileType: files[0].fileType || fileType,
            mock,
          }),
          responseFileName: files[0].fileName || fileName,
        }
      : {
          contentType: 'application/gzip',
          output: multipleFiles({ project_info, headers, chunkSize, ctx, files, mock }),
          responseFileName: fileName.replace(/(\.tar(\.gz)?)?$/, '.tar.gz'), // make sure file ends with '.tar.gz'
        };
  }

  console.warn('no files defined to download');
  throw new Error('files array was missing or empty');
};

export function downloader(project_info) {
  const router = express.Router();

  router.use(express.urlencoded({ extended: true }));

  router.post('/', async function (req, res) {
    try {
      const { params } = req.body;
      const requestHeaders = {
        ...req.headers,
        Authorization: `Bearer ${req.headers.authorization}`,
      };
      const { output, responseFileName, contentType } = await dataStream({
        project_info,
        headers: requestHeaders,
        ctx: req.context,
        params: JSON.parse(params),
      });

      res.set('Content-Type', contentType);
      res.set('Content-disposition', `attachment; filename=${responseFileName}`);
      output.pipe(res).on('finish', () => {});
    } catch (err) {
      console.error(err);

      res.status(400).send(err?.message || err?.details || 'An unknown error occurred.');
    }
  });

  return router;
}
