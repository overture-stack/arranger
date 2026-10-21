import { finished, pipeline, Transform } from 'node:stream';

import { Router, urlencoded } from 'express';

import {
	ACCESS_CONTROL_FAILURE_MESSAGE,
	ACCESS_CONTROL_UNAVAILABLE_MESSAGE,
	isAccessControlError,
	isAccessControlQueryTooLargeError,
	isAccessControlUnavailableError,
} from '#accessControl/AccessControlError.js';
import { arrangerLocalsOf, exportStateOf } from '#utils/context.js';
import dataToExportFormat from '#utils/dataToExportFormat.js';
import getAllData, { InvalidExportRequestError, isExportSort } from '#utils/getAllData.js';
import noopFn from '#utils/noops.js';

export { InvalidExportRequestError };

const SERVER_FAULT_TEXT = 'The download failed because of a problem on the server, not in the request.';

// The form parser refuses a body with a 4xx status and a type naming the rule it broke.
const BODY_RULES = new Map([
	['charset.unsupported', 'The request body must be encoded as UTF-8.'],
	['encoding.unsupported', 'The request body must be sent uncompressed, or compressed with gzip or deflate.'],
	['entity.too.large', 'The request body is larger than the download route accepts.'],
	['parameters.too.many', 'The request body holds more form fields than the download route accepts.'],
	['querystring.parse.rangeError', 'The request body nests its form fields deeper than the download route accepts.'],
]);

const UNREADABLE_BODY_TEXT = 'The request body must be a URL-encoded form holding params as one field of JSON.';

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
		message: 'files must be an array holding exactly one file object: this version exports one file per request.',
	},
	{
		isMet: ({ chunkSize, files: [file] }) => [chunkSize, file.chunkSize].every(isAbsentOr(isPositiveInteger)),
		message: 'chunkSize must be a positive integer, sent as a JSON number.',
	},
	{
		isMet: ({ files: [file] }) => isAbsentOr(isNonNegativeInteger)(file.maxRows),
		message: 'maxRows must be a non-negative integer, sent as a JSON number.',
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
 * @returns {Promise<{ contentType: string, exportTotals: () => { matchingTotal: number, truncated: boolean } | undefined, output: import('node:stream').Readable, responseFileName: string }>}
 *   `output` emits `'error'` when the export fails after it starts. `exportTotals` gives how many
 *   documents the export's filter matches and whether the row limit cut the export short, once its first
 *   row is formatted, and undefined before then or for an export that matched nothing.
 * @throws {InvalidExportRequestError} when `params` breaks a rule or its filter cannot be compiled.
 * @throws {AccessControlError} when no filter can be resolved or a callback cannot be evaluated.
 */
export const dataStream = async ({ ctx: givenContext, getServerSideFilter, params }) => {
	const ctx = exportStateOf(givenContext);
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

	// Recorded as the first chunk passes, so a route can mark a cut export in the headers it sends with
	// the first formatted row, which that chunk always precedes.
	let firstTotals;
	const recordTotals = new Transform({
		objectMode: true,
		transform(chunk, _encoding, callback) {
			firstTotals ??= { matchingTotal: chunk.matchingTotal, truncated: chunk.truncated };
			callback(null, chunk);
		},
	});

	// Every failure reaches the consumer as an 'error' on `output`, which pipeline destroys with it.
	pipeline(source, recordTotals, output, noopFn);

	return {
		contentType: 'text/plain',
		exportTotals: () => firstTotals,
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

// An invalid request is answered with the rule it broke: each rule's message is fixed text naming the
// field at fault, never a value the client sent, and is logged at info as the client's own mistake. Any
// other failure names only whose problem it is.
const failureResponseFor = (error) => {
	if (error instanceof InvalidExportRequestError) {
		return { event: 'download.invalid_request', log: console.info, status: 400, text: error.message };
	}

	// The callback's refusal to serve the request yet, answered with the router's text.
	if (isAccessControlUnavailableError(error)) {
		return {
			reason: 'access_control_unavailable',
			retryAfterSeconds: error.retryAfterSeconds,
			status: 503,
			text: ACCESS_CONTROL_UNAVAILABLE_MESSAGE,
		};
	}

	if (isAccessControlQueryTooLargeError(error)) {
		return {
			event: 'download.failed',
			log: console.error,
			reason: 'access_control_query_too_large',
			status: 500,
			text: error.message,
		};
	}

	return isAccessControlError(error)
		? {
				event: 'download.failed',
				log: console.error,
				reason: 'access_control',
				status: 500,
				text: ACCESS_CONTROL_FAILURE_MESSAGE,
			}
		: { event: 'download.failed', log: console.error, status: 500, text: SERVER_FAULT_TEXT };
};

const isClientErrorStatus = (status) => Number.isInteger(status) && status >= 400 && status < 500;

const unreadableBodyResponseFor = (error) =>
	isClientErrorStatus(error?.status)
		? {
				event: 'download.invalid_request',
				log: console.info,
				status: error.status,
				text: BODY_RULES.get(error.type) ?? UNREADABLE_BODY_TEXT,
			}
		: failureResponseFor(error);

const sendFailure = ({ error, failure = failureResponseFor(error), res }) => {
	const { event, log, reason, retryAfterSeconds, status, text } = failure;

	if (log) {
		log(event, error, ...(reason ? [{ reason }] : []));
	}

	if (Number.isSafeInteger(retryAfterSeconds) && retryAfterSeconds >= 0) {
		res.set('Retry-After', String(retryAfterSeconds));
	}

	if (reason === 'access_control') {
		// Also the event GraphQL and network search log for the same failure, so one alert covers every
		// read path while an alert already counting failed downloads keeps firing.
		console.error('access_control.evaluation_failed', error.message, { cause: error.cause, route: 'download' });
	}

	if (reason === 'access_control_query_too_large') {
		// Also the event GraphQL logs for the same refusal, for the same reason.
		console.error('access_control.query_too_large', {
			catalogue: error.catalogue,
			clauseLimit: error.clauseLimit,
			readPath: error.readPath,
			route: 'download',
		});
	}

	if (reason === 'access_control_unavailable') {
		// The event GraphQL logs for the same answer. Nothing is misconfigured, so it raises no alert.
		console.warn('access_control.unavailable_answered', error.message, {
			retryAfterSeconds: error.retryAfterSeconds,
			route: 'download',
		});
	}

	res.status(status).type('text/plain').set('X-Content-Type-Options', 'nosniff').send(text);
};

/** Marks a response whose export the row limit cut short, in headers a browser page may read. */
const markCutExport = ({ res, totals }) => {
	if (totals?.truncated) {
		res.append('Access-Control-Expose-Headers', 'Arranger-Export-Matching-Total, Arranger-Export-Truncated')
			.set('Arranger-Export-Matching-Total', String(totals.matchingTotal))
			.set('Arranger-Export-Truncated', 'true');
	}
};

// A response closed before its end is the client leaving, which is no fault of the server's. A search
// failing after that is logged by the export itself, since nothing reads it here.
const logStreamEnd = (error) => {
	if (error?.code === 'ERR_STREAM_PREMATURE_CLOSE') {
		console.info('download.client_disconnected');
	} else if (error) {
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
			pipeline(output, res, logStreamEnd);
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
 * server log only. A body the form parser refuses is answered the same way, with the rule it broke.
 *
 * @param {object} [args]
 * @param {boolean} [args.enableAdmin] also serves `GET /fields`, the fields flattened from the mapping.
 */
const download = ({ enableAdmin = false } = {}) => {
	const router = Router();

	router.use(urlencoded({ extended: true }));

	router.post('/', async (req, res) => {
		try {
			const { contentType, exportTotals, output, responseFileName } = await dataStream({
				ctx: res.locals,
				params: paramsFrom(req.body),
			});

			await pipeFromFirstChunk({
				output,
				res,
				setHeaders: () => {
					res.attachment(responseFileName)
						.set('Content-Type', contentType)
						.set('X-Content-Type-Options', 'nosniff');
					markCutExport({ res, totals: exportTotals() });
				},
			});
		} catch (error) {
			sendFailure({ error, res });
		}
	});

	if (enableAdmin) {
		// TODO: introspection endpoint!!! relocate
		router.get('/fields', async (req, res) => {
			// all the fields, as flattened from the ES mapping
			const { fieldsFromMapping } = arrangerLocalsOf(res);

			res.json(fieldsFromMapping);
		});
	}

	// Reached by a body the form parser refused, since the routes answer their own failures. Express
	// recognizes an error handler by its four parameters, so the unused `_next` stays.
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	router.use((error, _req, res, _next) => sendFailure({ error, failure: unreadableBodyResponseFor(error), res }));

	return router;
};

export default download;
