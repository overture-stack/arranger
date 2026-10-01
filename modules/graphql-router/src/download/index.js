import { finished, pipeline } from 'node:stream';

import { Router, urlencoded } from 'express';

import dataToExportFormat from '#utils/dataToExportFormat.js';
import getAllData, { InvalidExportRequestError, isExportSort } from '#utils/getAllData.js';
import noopFn from '#utils/noops.js';

export { InvalidExportRequestError };

const INVALID_REQUEST_TEXT = 'The download request is invalid.';
const SERVER_FAULT_TEXT = 'The download could not be completed.';

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

const isAbsentOr = (isValid) => (value) => value === undefined || isValid(value);

const isPositiveInteger = (value) => Number.isInteger(value) && value > 0;

const isNonNegativeInteger = (value) => Number.isInteger(value) && value >= 0;

const isString = (value) => typeof value === 'string';

// A lone surrogate has no UTF-8 form, so no Content-Disposition encoding can carry it.
const isWellFormedString = (value) => isString(value) && value.isWellFormed();

const isFileType = (value) => [null, '', 'json', 'tsv'].includes(value);

const isColumnList = (value) => Array.isArray(value) && value.length > 0 && value.every(isPlainObject);

// In order, so each rule can rely on the ones before it. Messages name the field and never its value,
// since params arrive from the client.
const PARAMS_RULES = [
	{ isMet: isPlainObject, message: 'params must be an object.' },
	{
		isMet: ({ files }) => Array.isArray(files) && files.length === 1 && isPlainObject(files[0]),
		message: 'files must be an array holding exactly one file object.',
	},
	{
		isMet: ({ chunkSize, files: [file] }) => [chunkSize, file.chunkSize].every(isAbsentOr(isPositiveInteger)),
		message: 'chunkSize must be a positive integer.',
	},
	{
		isMet: ({ files: [file] }) => isAbsentOr(isNonNegativeInteger)(file.maxRows),
		message: 'maxRows must be a non-negative integer.',
	},
	{
		isMet: ({ fileType, files: [file] }) => [fileType, file.fileType].every(isAbsentOr(isFileType)),
		message: 'fileType must be tsv or json.',
	},
	{
		isMet: ({ files: [file] }) => isColumnList(file.columns),
		message: 'columns must be a non-empty array of column objects.',
	},
	{
		isMet: ({ files: [file] }) => isAbsentOr(isExportSort)(file.sort),
		message: 'sort must be an array of entries, each with a non-empty fieldName and an order of asc or desc.',
	},
	{
		isMet: ({ fileName, files: [file] }) => [fileName, file.fileName].every(isAbsentOr(isWellFormedString)),
		message: 'fileName must be a well-formed string.',
	},
	{
		isMet: ({ files: [file] }) => isAbsentOr(isString)(file.uniqueBy),
		message: 'uniqueBy must be a string.',
	},
	{
		isMet: ({ files: [file] }) => isAbsentOr(isString)(file.valueWhenEmpty),
		message: 'valueWhenEmpty must be a string.',
	},
];

const requireValidParams = (params) => {
	const brokenRule = PARAMS_RULES.find(({ isMet }) => !isMet(params));

	if (brokenRule === undefined) {
		return params;
	}

	throw new InvalidExportRequestError(brokenRule.message);
};

/**
 * Streams one file of an export, formatted as TSV or JSON lines, for an integration route to send.
 * `params` is validated here, so the client's object can be passed whole: only the file's export
 * fields are read, and anything else it carries is ignored.
 *
 * @template Context
 * @param {object} args
 * @param {Context} args.ctx the request context, normally the one a router built.
 * @param {import('@overture-stack/arranger-types/configs').GetServerSideFilterFn<Context>} [args.getServerSideFilter]
 *   a filter of the caller's own, which can only narrow the one the router recorded.
 * @param {unknown} args.params the download params as the client sent them, holding exactly one file.
 * @returns {Promise<{ contentType: string, output: import('node:stream').Readable, responseFileName: string }>}
 *   `output` emits `'error'` when the export fails after it starts.
 * @throws {InvalidExportRequestError} when `params` breaks a rule or its filter cannot be compiled.
 * @throws {AccessControlError} when no filter can be resolved or a callback cannot be evaluated.
 */
export const dataStream = async ({ ctx, getServerSideFilter, params }) => {
	const {
		chunkSize: defaultChunkSize,
		fileName: defaultFileName,
		fileType: defaultFileType,
		files: [{ chunkSize, columns, fileName, fileType, maxRows, sort, sqon, uniqueBy, valueWhenEmpty }],
	} = requireValidParams(params);
	const outputFileType = fileType || defaultFileType || 'tsv';

	const source = await getAllData({
		chunkSize: chunkSize ?? defaultChunkSize,
		ctx,
		getServerSideFilter,
		maxRows,
		sort,
		sqon,
	});
	const output = dataToExportFormat({ columns, ctx, fileType: outputFileType, uniqueBy, valueWhenEmpty });

	// Every failure reaches the consumer as an 'error' on `output`, which pipeline destroys with it.
	pipeline(source, output, noopFn);

	return {
		contentType: 'text/plain',
		output,
		responseFileName: fileName || defaultFileName || `file.${outputFileType}`,
	};
};

const paramsFrom = (body) => {
	if (typeof body?.params === 'string') {
		try {
			return JSON.parse(body.params);
		} catch (cause) {
			throw new InvalidExportRequestError('params must be JSON.', { cause });
		}
	}

	throw new InvalidExportRequestError('params must be sent as one form field holding JSON.');
};

const failureResponseFor = (error) =>
	error instanceof InvalidExportRequestError
		? { event: 'download.invalid_request', log: console.warn, status: 400, text: INVALID_REQUEST_TEXT }
		: { event: 'download.failed', log: console.error, status: 500, text: SERVER_FAULT_TEXT };

const sendFailure = ({ error, res }) => {
	const { event, log, status, text } = failureResponseFor(error);

	log(event, error);
	res.status(status).type('text/plain').set('X-Content-Type-Options', 'nosniff').send(text);
};

const logStreamFailure = (error) => {
	if (error) {
		console.error('download.stream_failed', error);
	}
};

// Piped from inside the event announcing the first formatted chunk, or an empty end, rather than after
// awaiting it: a failure already queued would otherwise be emitted in between, reaching neither. A
// response closed before then is never piped, since pipeline throws on a closed destination; the
// export is stopped instead.
const pipeFromFirstChunk = ({ output, res, setHeaders }) =>
	new Promise((resolve, reject) => {
		const stopWaiting = () => {
			output.off('error', failBeforeOutput);
			output.off('readable', startResponse);
			stopWatchingResponse();
		};
		const failBeforeOutput = (error) => {
			stopWaiting();
			reject(error);
		};
		const startResponse = () => {
			stopWaiting();
			setHeaders();
			pipeline(output, res, logStreamFailure);
			resolve();
		};
		const stopExport = () => {
			stopWaiting();
			output.destroy();
			resolve();
		};
		const stopWatchingResponse = finished(res, stopExport);

		output.once('error', failBeforeOutput);
		output.once('readable', startResponse);
	});

/**
 * The router's `/download` routes: `POST /` exports one file of the catalogue under the filter the
 * router recorded on the request context. Headers wait until the first chunk is formatted, so a
 * failure before any output answers with an error status and fixed text, the detail going to the
 * server log only.
 *
 * @param {object} [args]
 * @param {boolean} [args.enableAdmin] also serves `GET /fields`, the fields flattened from the mapping.
 */
const download = ({ enableAdmin = false } = {}) => {
	const router = Router();

	router.use(urlencoded({ extended: true }));

	router.post('/', async (req, res) => {
		try {
			const { contentType, output, responseFileName } = await dataStream({
				ctx: req.context,
				params: paramsFrom(req.body),
			});

			await pipeFromFirstChunk({
				output,
				res,
				setHeaders: () => res.attachment(responseFileName).set('Content-Type', contentType),
			});
		} catch (error) {
			sendFailure({ error, res });
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
