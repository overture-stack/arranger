import zlib from 'node:zlib';

import { Router, urlencoded } from 'express';
import { defaults } from 'lodash-es';
import { pack as tarPack } from 'tar-stream';

import dataToExportFormat from '#utils/dataToExportFormat.js';
import getAllData from '#utils/getAllData.js';

// nfdhjfjhdfjf

const convertDataToExportFormat =
	({ ctx, fileType }) =>
	async (args) =>
		(
			await getAllData({
				ctx,
				...args,
			})
		).pipe(dataToExportFormat({ ...args, ctx, fileType }));

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

const download = ({ enableAdmin }) => {
	console.log('enableAdmin', enableAdmin);

	const router = Router();

	router.use(urlencoded({ extended: true }));

	router.post('/', async function (req, res) {
		try {
			console.time('download');

			const { params } = req.body;

			const { output, responseFileName, contentType } = await dataStream({
				ctx: req.context,
				params: JSON.parse(params),
			});

			res.set('Content-Type', contentType);
			res.set('Content-disposition', `attachment; filename=${responseFileName}`);
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
		router.get('/fields', async (req, res) => {
			// all the fields, as flattened from the ES mapping
			const { fieldsFromMapping } = req.context;

			res.json(fieldsFromMapping);
		});
	}

	return router;
};

export default download;
