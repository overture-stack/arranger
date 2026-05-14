import zlib from 'node:zlib';

import { Router, urlencoded } from 'express';
import { defaults } from 'lodash-es';
import { pack as tarPack } from 'tar-stream';

import dataToExportFormat from '#utils/dataToExportFormat.js';
import getAllData from '#utils/getAllData.js';

const convertDataToExportFormat =
	({ ctx, fileType }) =>
	async (args) =>
		(
			await getAllData({
				ctx,
				...args,
			})
		)
			.on('error', (err) => {
				console.error('Stream error:', err);
			})
			.pipe(dataToExportFormat({ ...args, ctx, fileType }));

const getFileStream = async ({ chunkSize, ctx, file, fileType, mock }) => {
	const exportArgs = defaults(file, { chunkSize, fileType, mock });

	return convertDataToExportFormat({ ctx, fileType })({
		...exportArgs,
		mock,
	});
};

const multipleFiles = async ({ chunkSize, ctx, files, mock }) => {
	const pack = tarPack();

	Promise.all(
		files.map((file, i) => {
			// TODO: this async as the executor of a Promise is smelly
			// eslint.org/docs/latest/rules/no-async-promise-executor
			return new Promise(async (resolve, reject) => {
				// pack needs the size of the stream. We don't know that until we get all the data.
				// This collects all the data before adding it.
				let data = '';
				const fileStream = await getFileStream({
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

	return pack.pipe(zlib.createGzip());
};

export const dataStream = async ({ ctx, params }) => {
	const { chunkSize, files, fileName = 'file.tar.gz', fileType = 'tsv', mock } = params;

	if (files?.length > 0) {
		return files.length === 1
			? {
					contentType: 'text/plain',
					output: await getFileStream({
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
					output: multipleFiles({ chunkSize, ctx, files, mock }),
					responseFileName: fileName.replace(/(\.tar(\.gz)?)?$/, '.tar.gz'), // make sure file ends with '.tar.gz'
				};
	}

	console.warn('no files defined to download');
	throw new Error('files array was missing or empty');
};

const download = ({ enableAdmin = false, enableDebug = false }) => {
	const router = Router();

	router.use(urlencoded({ extended: true }));

	router.post('/', async function (req, res) {
		try {
			const ctx = req.context;
			console.time('download');

			const { params } = req.body;

			const { output, responseFileName, contentType } = await dataStream({
				ctx,
				params: JSON.parse(params),
			});

			ctx.enableDebug && console.debug('  DEBUG: === SETTING UP RESPONSE ===');

			res.set('Content-Type', contentType);
			res.set('Content-disposition', `attachment; filename=${responseFileName}`);

			if (ctx.enableDebug) {
				let bytesWritten = 0;
				let chunksReceived = 0;

				output.on('data', (chunk) => {
					chunksReceived++;
					bytesWritten += chunk.length || 0;
					// console.log(
					// 	`OUTPUT data chunk ${chunksReceived}, size: ${chunk.length}, total bytes: ${bytesWritten}`,
					// );
				});

				output.on('end', () =>
					console.log(`OUTPUT ENDED after ${chunksReceived} chunks, ${bytesWritten} bytes`),
				);
				output.on('close', () => console.log('OUTPUT CLOSED'));
				output.on('error', (err) => console.error('OUTPUT ERROR:', err));

				res.on('finish', () => console.log('RESPONSE FINISHED'));
				res.on('close', () => console.log('RESPONSE CLOSED (client may have disconnected)'));
				res.on('error', (err) => console.error('RESPONSE ERROR:', err));
			}

			output.pipe(res).on('finish', () => {
				console.timeEnd('download');
			});
		} catch (err) {
			console.error(err);
			console.timeEnd('download');

			res.status(400).send(err?.message || err?.details || 'An unknown error occurred.');
		}
	});

	if (enableAdmin) {
		// TODO: introspection endpoint!!! relocate
		router.get('/fields', async (req, res) => {
			// all the fields, as flattened from the ES mapping
			const { fieldsFromMapping } = req.context;

			res.json(fieldsFromMapping);
		});
	}

	return router;
};

export default download;
