import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { after, before, beforeEach, mock, suite, test } from 'node:test';
import { inspect } from 'node:util';

import express from 'express';
import request from 'supertest';

import { denyAllFilter, restrictingFilter } from '#accessControl/serverSideFilters.fixture.js';
import arrangerRouter from '#router.js';
import { wrapOpenSearchClient } from '#searchClient/index.js';

import { dataStream, InvalidExportRequestError } from './index.js';

/*
 * The export pipeline as a deployment and an integration meet it: the router's own POST /download,
 * and `dataStream` called by an application route mounted after the router with the request's
 * context. Every route test builds a real router over a search engine stand-in that evaluates the
 * queries it receives, so a filter that restricts changes the rows returned.
 */

const DOCUMENT_TYPE = 'donor';
const INDEX_NAME = 'donor_index';
const CLIENT_TEXT = 'text-the-client-chose';
const SETTLE_TIMEOUT = 3_000;

const MAPPING = {
	age: { type: 'integer' },
	diagnosis: { type: 'keyword' },
	diagnosis_date: { type: 'date' },
	donor_id: { type: 'keyword' },
	files: { properties: { file_id: { type: 'keyword' } }, type: 'nested' },
	study: { type: 'keyword' },
};

// Study alternates A and B; ages are out of id order; some donors have no diagnosis; DO_01 holds
// two files and DO_02 none, so a uniqueBy export has both an expanding and an empty case.
const DOCUMENTS = [
	['DO_01', 'A', 41, 'C50', ['FL_01a', 'FL_01b']],
	['DO_02', 'B', 29, undefined, []],
	['DO_03', 'A', 63, 'C18', ['FL_03']],
	['DO_04', 'B', 35, 'C34', ['FL_04']],
	['DO_05', 'A', 58, undefined, ['FL_05']],
	['DO_06', 'B', 22, 'C61', []],
	['DO_07', 'A', 47, 'C25', ['FL_07']],
	['DO_08', 'B', 30, undefined, ['FL_08']],
].map(([donorId, study, age, diagnosis, fileIds]) => ({
	_id: donorId,
	_source: {
		age,
		...(diagnosis ? { diagnosis } : {}),
		diagnosis_date: '2020-01-15',
		donor_id: donorId,
		files: fileIds.map((fileId) => ({ file_id: fileId })),
		study,
	},
}));

const ALL_DONOR_IDS = DOCUMENTS.map((document) => document._id);
const STUDY_A_DONOR_IDS = DOCUMENTS.filter((document) => document._source.study === 'A').map(
	(document) => document._id,
);

/** `count` plain donors `DO_001` onwards, for exports that need many pages. */
const generatedDocuments = (count) =>
	Array.from({ length: count }, (_unused, index) => {
		const donorId = `DO_${String(index + 1).padStart(3, '0')}`;
		return { _id: donorId, _source: { donor_id: donorId, study: index % 2 ? 'B' : 'A' } };
	});

// The column descriptors the stock table UI posts: whole column objects, not just field names.
const columnFor = ({ displayName, fieldName, type = 'keyword', ...rest }) => ({
	accessor: fieldName,
	canChangeShow: true,
	displayName,
	fieldName,
	isArray: false,
	jsonPath: null,
	query: null,
	show: true,
	sortable: true,
	type,
	...rest,
});

const STOCK_COLUMNS = [
	columnFor({ displayName: 'Donor ID', fieldName: 'donor_id' }),
	columnFor({ displayName: 'Study', fieldName: 'study' }),
];

// One file as the stock download button posts it, documentType included.
const STOCK_FILE = {
	columns: STOCK_COLUMNS,
	documentType: DOCUMENT_TYPE,
	fileName: 'donors.tsv',
	fileType: 'tsv',
	maxRows: 0,
	sqon: null,
	valueWhenEmpty: '--',
};

const STOCK_HEADER = 'Donor ID\tStudy\n';

/** The stock TSV for `donorIds`, from whichever document list holds them. */
const tsvOf = (donorIds, documents = DOCUMENTS) =>
	STOCK_HEADER +
	donorIds
		.map((donorId) => documents.find((document) => document._id === donorId))
		.map(({ _source }) => `${_source.donor_id}\t${_source.study}\n`)
		.join('');

/** The first cell of every line after the header. */
const dataRowIdsOf = (tsvText) =>
	tsvText
		.split('\n')
		.slice(1)
		.filter(Boolean)
		.map((line) => line.split('\t')[0]);

const paramsWithFile = (fileOverrides = {}, topLevel = {}) => ({
	fileName: '',
	files: [{ ...STOCK_FILE, ...fileOverrides }],
	...topLevel,
});

const paramsWithFiles = (files) => ({ fileName: '', files });

const fileWithout = (...fieldNames) =>
	Object.fromEntries(Object.entries(STOCK_FILE).filter(([fieldName]) => !fieldNames.includes(fieldName)));

const inDonorIds = (donorIds) => ({
	content: [{ content: { fieldName: 'donor_id', value: donorIds }, op: 'in' }],
	op: 'and',
});

// A context shaped like the router's own, offered by the client in place of it.
const CLIENT_CONTEXT = {
	configs: {
		config: { disableFilters: true, downloads: { allowCustomMaxRows: true, maxRows: 0 } },
		index: 'other_index',
		name: 'other',
		nested_fieldNames: [],
	},
	esClient: null,
};

/*
 * The search engine stand-in. It evaluates `bool` and `terms` over flat fields, orders by the
 * request's sort, honours `search_after` and `size`, and refuses any clause it cannot evaluate, so
 * a query it does not understand fails loudly instead of matching everything.
 */

const fieldValuesOf = (document, fieldName) =>
	fieldName === '_id' ? [document._id] : [].concat(document._source[fieldName] ?? []);

const matchesClause = (document, clause) => {
	const [kind, body] = Object.entries(clause ?? {})[0] ?? [];

	switch (kind) {
		case undefined:
		case 'match_all':
			return true;

		case 'bool':
			return matchesBool(document, body);

		case 'terms': {
			const [fieldName, wanted] = Object.entries(body).find(([key]) => key !== 'boost');
			return wanted.some((value) => fieldValuesOf(document, fieldName).includes(value));
		}

		default:
			throw new Error(`The search engine stand-in cannot evaluate a "${kind}" clause`);
	}
};

const matchesBool = (document, { filter = [], must = [], must_not: mustNot = [], should = [] }) => {
	const required = [...[].concat(must), ...[].concat(filter)];
	const optional = [].concat(should);

	return (
		required.every((clause) => matchesClause(document, clause)) &&
		![].concat(mustNot).some((clause) => matchesClause(document, clause)) &&
		(optional.length === 0 || required.length > 0 || optional.some((clause) => matchesClause(document, clause)))
	);
};

const directionOf = (sortEntry) => {
	const [setting] = Object.values(sortEntry);
	return (typeof setting === 'object' ? setting?.order : setting) === 'desc' ? -1 : 1;
};

const sortKeyOf = (document, sort) =>
	sort.map((sortEntry) => {
		const [fieldName] = Object.keys(sortEntry);
		return fieldName === '_id' ? document._id : document._source[fieldName];
	});

const compareSortKeys = (left, right, sort) => {
	for (const [position, sortEntry] of sort.entries()) {
		if (left[position] !== right[position]) {
			return (left[position] < right[position] ? -1 : 1) * directionOf(sortEntry);
		}
	}
	return 0;
};

/**
 * @param documents what the index holds.
 * @param failOnRequest the 1-based search that rejects with `failureMessage`.
 * @param holdFromRequest the 1-based search from which every search waits until `release` is called.
 * @param shardFailureOnRequest the 1-based search whose response reports a failed shard.
 */
const createSearchEngine = ({
	documents = DOCUMENTS,
	failOnRequest,
	failureMessage = 'search failed',
	holdFromRequest = Infinity,
	shardFailureOnRequest,
} = {}) => {
	const requests = [];
	const heldSearches = [];
	let released = false;

	const release = () => {
		released = true;
		heldSearches.splice(0).forEach((resume) => resume());
	};

	const search = async (searchRequest) => {
		requests.push(searchRequest);
		const requestNumber = requests.length;

		if (requestNumber >= holdFromRequest && !released) {
			await new Promise((resume) => heldSearches.push(resume));
		}

		if (requestNumber === failOnRequest) {
			throw new Error(failureMessage);
		}

		const { body = {} } = searchRequest;
		const sort = body.sort ?? [{ _id: 'asc' }];
		const searchAfter = body.search_after ?? searchRequest.search_after;
		const matching = documents
			.filter((document) => matchesClause(document, body.query))
			.sort((left, right) => compareSortKeys(sortKeyOf(left, sort), sortKeyOf(right, sort), sort));
		const remaining = searchAfter
			? matching.filter((document) => compareSortKeys(sortKeyOf(document, sort), searchAfter, sort) > 0)
			: matching;
		const page = remaining.slice(0, searchRequest.size ?? body.size ?? 10);
		const failedShards = requestNumber === shardFailureOnRequest ? 1 : 0;

		return {
			body: {
				_shards: { failed: failedShards, successful: 1 - failedShards, total: 1 },
				hits: {
					hits: page.map((document) => ({
						...document,
						_index: INDEX_NAME,
						sort: sortKeyOf(document, sort),
					})),
					total: { relation: 'eq', value: matching.length },
				},
			},
		};
	};

	return {
		client: {
			cat: { aliases: async () => ({ body: [] }) },
			indices: {
				getMapping: async ({ index }) => ({ body: { [index]: { mappings: { properties: MAPPING } } } }),
			},
			search,
		},
		release,
		requests,
		reset: () => requests.splice(0),
	};
};

/** Resolves once `requests` has stopped growing for `quietMilliseconds`. */
const waitForEngineToSettle = async (requests, quietMilliseconds = 50) => {
	let previousCount = -1;

	while (previousCount !== requests.length) {
		previousCount = requests.length;
		await new Promise((resume) => setTimeout(resume, quietMilliseconds));
	}
};

const pause = (milliseconds) => new Promise((resume) => setTimeout(resume, milliseconds));

/**
 * Builds a router over a fresh search engine stand-in and serves it, as a deployment would, with an
 * application's own routes mounted after it: `/alive`, and `/context`, which records the request
 * context the router built so a test can hand it to `dataStream` as an integration route would.
 */
const startArranger = async ({ downloads, getServerSideFilter, ...engineOptions } = {}) => {
	const engine = createSearchEngine(engineOptions);
	const router = await arrangerRouter({
		configs: { documentType: DOCUMENT_TYPE, esIndex: INDEX_NAME, ...(downloads ? { downloads } : {}) },
		esClient: wrapOpenSearchClient(engine.client),
		...(getServerSideFilter ? { getServerSideFilter } : {}),
	});

	let lastContext;
	const app = express()
		.use(router)
		.get('/alive', (_request, response) => response.send('alive'))
		.get('/context', (incoming, response) => {
			lastContext = incoming.context;
			response.sendStatus(204);
		});

	const server = app.listen(0, '127.0.0.1');
	await once(server, 'listening');

	return {
		captureContext: async () => {
			await request(server).get('/context');
			return lastContext;
		},
		close: () =>
			new Promise((resolve) => {
				server.closeAllConnections();
				server.close(() => resolve());
			}),
		engine,
		server,
	};
};

const withArranger = async (options, useArranger) => {
	const arranger = await startArranger(options);
	try {
		return await useArranger(arranger);
	} finally {
		arranger.engine.release();
		await arranger.close();
	}
};

const postForm = (server, form) => request(server).post('/download').type('form').send(form);

const postDownload = (server, params) =>
	postForm(server, { downloadKey: 'download-key', httpHeaders: '{}', params: JSON.stringify(params) });

/** Settles a request either way, telling a hang apart from an aborted transfer. */
const settle = (pendingRequest) => {
	let timer;
	const hung = new Promise((resolve) => {
		timer = setTimeout(() => resolve({ outcome: 'hung' }), SETTLE_TIMEOUT);
	});
	const settled = Promise.resolve(pendingRequest).then(
		(response) => ({ outcome: 'response', response }),
		(error) => ({ error, outcome: 'error' }),
	);

	return Promise.race([settled, hung]).finally(() => clearTimeout(timer));
};

/** A failed download either answers an error status or aborts; it never hangs, and never completes as a 200. */
const assertNotACompleteSuccess = (result, forbiddenTexts = []) => {
	assert.notEqual(result.outcome, 'hung', `the request should settle within ${SETTLE_TIMEOUT} ms`);

	if (result.outcome === 'response') {
		assert.ok(
			result.response.status >= 400,
			`expected an error status or an aborted transfer, got a complete ${result.response.status}`,
		);
		forbiddenTexts.forEach((text) =>
			assert.ok(!result.response.text.includes(text), `the body should not contain ${JSON.stringify(text)}`),
		);
	}
};

const assertPlainTextError = (response, expectedStatus, forbiddenTexts = []) => {
	assert.equal(response.status, expectedStatus);
	assert.match(response.headers['content-type'] ?? '', /^text\/plain/);
	assert.equal(response.headers['x-content-type-options'], 'nosniff');
	assert.ok(response.text.length > 0, 'the error should carry a fixed explanation');

	for (const text of [CLIENT_TEXT, ...forbiddenTexts]) {
		assert.ok(!response.text.includes(text), `the body should not contain ${JSON.stringify(text)}`);
	}
};

const assertStillServing = async (arranger) => {
	assert.equal((await request(arranger.server).get('/alive')).status, 200);

	const download = await postDownload(arranger.server, paramsWithFile());
	assert.equal(download.status, 200, 'a well-formed download should still succeed');
};

/** Runs `action`, then fails if it raised an uncaught exception or an unhandled rejection anywhere in the process. */
const runWatchingForProcessFaults = async (action) => {
	const faults = [];
	const record = (fault) => faults.push(fault);
	process.on('uncaughtException', record);
	process.on('unhandledRejection', record);

	let actionError;
	let result;

	try {
		result = await action();
		await pause(50);
	} catch (error) {
		actionError = error;
	} finally {
		process.off('uncaughtException', record);
		process.off('unhandledRejection', record);
	}

	if (faults.length > 0) {
		assert.fail(
			`no uncaught exception or unhandled rejection should be raised, got:\n${faults.map((fault) => inspect(fault)).join('\n')}` +
				(actionError ? `\nand the test itself failed: ${actionError.message}` : ''),
		);
	}

	if (actionError) {
		throw actionError;
	}

	return result;
};

/** Silences the console, keeping everything written to it for `loggedText`. */
const captureConsole = () => {
	const spies = ['debug', 'error', 'info', 'log', 'warn'].map((method) => mock.method(console, method, () => {}));

	return {
		loggedText: () =>
			spies
				.flatMap((spy) => spy.mock.calls.flatMap((call) => call.arguments))
				.map((argument) => (typeof argument === 'string' ? argument : inspect(argument, { depth: 8 })))
				.join('\n'),
		restore: () => spies.forEach((spy) => spy.mock.restore()),
	};
};

/** Reads a dataStream output to its end: `{ chunks, outcome: 'ended' | 'errored' | 'hung', error? }`. */
const settleOutput = (output) =>
	new Promise((resolve) => {
		const chunks = [];
		const timer = setTimeout(() => resolve({ chunks, outcome: 'hung' }), SETTLE_TIMEOUT);

		output.on('data', (chunk) => chunks.push(chunk));
		output.once('end', () => {
			clearTimeout(timer);
			resolve({ chunks, outcome: 'ended' });
		});
		output.once('error', (error) => {
			clearTimeout(timer);
			resolve({ chunks, error, outcome: 'errored' });
		});
	});

const readOutput = async (output) => {
	const { chunks, error, outcome } = await settleOutput(output);
	assert.equal(outcome, 'ended', `the output should end cleanly: ${error ?? outcome}`);
	return chunks;
};

/** Starts a dataStream call and settles it either way, including a rejection before any output. */
const settleDataStream = async (startCall) => {
	try {
		return await settleOutput((await startCall()).output);
	} catch (error) {
		return { error, outcome: 'rejected' };
	}
};

/** RFC 6266 disposition type and file name, preferring the extended `filename*` parameter as recipients must. */
const parseContentDisposition = (header = '') => {
	const [dispositionType] = header.split(';', 1);
	const extended = /;\s*filename\*\s*=\s*[^']*'[^']*'([^;\s]*)/i.exec(header);
	const quoted = /;\s*filename\s*=\s*"((?:[^"\\]|\\.)*)"/i.exec(header);
	const token = /;\s*filename\s*=\s*([^";\s][^;\s]*)/i.exec(header);

	const fileName = extended
		? decodeURIComponent(extended[1])
		: quoted
			? quoted[1].replace(/\\(.)/g, '$1')
			: token?.[1];

	return { dispositionType: dispositionType.trim().toLowerCase(), fileName };
};

const rawHeaderCount = (response, headerName) =>
	response.res.rawHeaders.filter((value, position) => position % 2 === 0 && value.toLowerCase() === headerName)
		.length;

/** Posts a download over a raw connection and drops it once the header and the first row have arrived. */
const disconnectAfterFirstRow = (server, params) =>
	new Promise((resolve, reject) => {
		const body = new URLSearchParams({ params: JSON.stringify(params) }).toString();
		const timer = setTimeout(() => reject(new Error('no row arrived before the deadline')), SETTLE_TIMEOUT);
		const clientRequest = http.request(
			{
				headers: {
					'content-length': Buffer.byteLength(body),
					'content-type': 'application/x-www-form-urlencoded',
				},
				host: '127.0.0.1',
				method: 'POST',
				path: '/download',
				port: server.address().port,
			},
			(response) => {
				let received = '';

				response.on('data', (chunk) => {
					received += chunk;

					if (received.split('\n').length > 2) {
						clearTimeout(timer);
						clientRequest.destroy();
						resolve({ received, status: response.statusCode });
					}
				});
				response.on('end', () => {
					clearTimeout(timer);
					resolve({ received, status: response.statusCode });
				});
			},
		);

		clientRequest.on('error', () => {});
		clientRequest.end(body);
	});

/*
 * Params a download must refuse. Each is tried both at the route, which must answer 400, and
 * against `dataStream` directly, which must reject: an integration calling it receives the client's
 * object as it arrived, so the route's own checks protect nobody else.
 */
const INVALID_PARAMS = [
	{ name: 'params that is null', params: null },
	{ name: 'params that is a number', params: 5 },
	{ name: 'params that is a string', params: CLIENT_TEXT },
	{ name: 'params that is an array', params: [paramsWithFile()] },
	{ name: 'files that is absent', params: { fileName: '' } },
	{ name: 'files that is an empty array', params: paramsWithFiles([]) },
	{ name: 'files that is a string', params: paramsWithFiles(CLIENT_TEXT) },
	{ name: 'files that is an array-like object', params: paramsWithFiles({ 0: STOCK_FILE, length: 1 }) },
	{ name: 'files holding two files', params: paramsWithFiles([STOCK_FILE, STOCK_FILE]) },
	{ name: 'a file that is null', params: paramsWithFiles([null]) },
	{ name: 'a file that is a string', params: paramsWithFiles([CLIENT_TEXT]) },
	{ name: 'a chunkSize of 0', params: paramsWithFile({ chunkSize: 0 }) },
	{ name: 'a negative chunkSize', params: paramsWithFile({ chunkSize: -1 }) },
	{ name: 'a fractional chunkSize', params: paramsWithFile({ chunkSize: 1.5 }) },
	{ name: 'a chunkSize given as a numeric string', params: paramsWithFile({ chunkSize: '2' }) },
	{ name: 'a chunkSize of null', params: paramsWithFile({ chunkSize: null }) },
	{ name: 'a chunkSize given as client text', params: paramsWithFile({ chunkSize: CLIENT_TEXT }) },
	{ name: 'a top-level chunkSize of 0', params: paramsWithFile({}, { chunkSize: 0 }) },
	{ name: 'a top-level chunkSize of null', params: paramsWithFile({}, { chunkSize: null }) },
	{ name: 'a top-level chunkSize given as client text', params: paramsWithFile({}, { chunkSize: CLIENT_TEXT }) },
	{ name: 'a negative maxRows', params: paramsWithFile({ maxRows: -1 }) },
	{ name: 'a fractional maxRows', params: paramsWithFile({ maxRows: 1.5 }) },
	{ name: 'a maxRows given as a numeric string', params: paramsWithFile({ maxRows: '5' }) },
	{ name: 'a maxRows given as client text', params: paramsWithFile({ maxRows: CLIENT_TEXT }) },
	{ name: 'a fileType other than tsv or json', params: paramsWithFile({ fileType: 'xml' }) },
	{ name: 'a fileType that is a number', params: paramsWithFile({ fileType: 5 }) },
	{ name: 'a fileType given as client text', params: paramsWithFile({ fileType: CLIENT_TEXT }) },
	{
		name: 'a top-level fileType other than tsv or json, when the file names none',
		params: { fileName: '', fileType: 'xml', files: [fileWithout('fileType')] },
	},
	{
		name: 'a top-level fileType other than tsv or json, even when the file names its own',
		params: paramsWithFile({}, { fileType: 'xml' }),
	},
	{ name: 'absent columns', params: paramsWithFiles([fileWithout('columns')]) },
	{ name: 'columns given as a string', params: paramsWithFile({ columns: 'donor_id' }) },
	{
		name: 'columns given as an object keyed by field',
		params: paramsWithFile({ columns: { donor_id: STOCK_COLUMNS[0] } }),
	},
	{ name: 'columns that is an empty array', params: paramsWithFile({ columns: [] }) },
	{ name: 'a column that is null', params: paramsWithFile({ columns: [null] }) },
	{ name: 'a column given as a string', params: paramsWithFile({ columns: ['donor_id'] }) },
	{ name: 'columns given as client text', params: paramsWithFile({ columns: CLIENT_TEXT }) },
	{ name: 'a uniqueBy that is a number', params: paramsWithFile({ uniqueBy: 5 }) },
	{ name: 'a uniqueBy that is an object', params: paramsWithFile({ uniqueBy: { path: 'files' } }) },
	{ name: 'a valueWhenEmpty that is a number', params: paramsWithFile({ valueWhenEmpty: 5 }) },
	{ name: 'a fileName that is a number', params: paramsWithFile({ fileName: 5 }) },
	{ name: 'a fileName that is an object', params: paramsWithFile({ fileName: { name: CLIENT_TEXT } }) },
	{ name: 'a top-level fileName that is a number', params: paramsWithFile({}, { fileName: 5 }) },
	{ name: 'a sort of null', params: paramsWithFile({ sort: null }) },
	{ name: 'a sort given as a string', params: paramsWithFile({ sort: 'age' }) },
	{
		name: 'a sort entry given alone, outside an array',
		params: paramsWithFile({ sort: { fieldName: 'age', order: 'asc' } }),
	},
	{ name: 'a sort holding null', params: paramsWithFile({ sort: [null] }) },
	{ name: 'a sort holding a string', params: paramsWithFile({ sort: ['age'] }) },
	{ name: 'a sort entry with no fieldName', params: paramsWithFile({ sort: [{ order: 'asc' }] }) },
	{
		name: 'a sort entry whose fieldName is empty',
		params: paramsWithFile({ sort: [{ fieldName: '', order: 'asc' }] }),
	},
	{
		name: 'a sort entry whose fieldName is a number',
		params: paramsWithFile({ sort: [{ fieldName: 5, order: 'asc' }] }),
	},
	{
		name: 'a sort entry whose fieldName is an object',
		params: paramsWithFile({ sort: [{ fieldName: { name: 'age' }, order: 'asc' }] }),
	},
	{ name: 'a sort entry with no order', params: paramsWithFile({ sort: [{ fieldName: 'age' }] }) },
	{
		name: 'a sort entry whose order is neither asc nor desc',
		params: paramsWithFile({ sort: [{ fieldName: 'age', order: 'sideways' }] }),
	},
	{
		name: 'a sort entry whose order is an object',
		params: paramsWithFile({ sort: [{ fieldName: 'age', order: { order: 'asc' } }] }),
	},
	{
		name: 'a valid sort entry followed by one with no order',
		params: paramsWithFile({ sort: [{ fieldName: 'age', order: 'asc' }, { fieldName: 'study' }] }),
	},
];

// Form bodies only the route can receive, before any JSON is parsed.
const INVALID_FORMS = [
	{ form: { httpHeaders: '{}' }, name: 'no params field' },
	{ form: { params: CLIENT_TEXT }, name: 'params that is not JSON' },
	{ form: { params: '' }, name: 'params that is empty' },
	{ form: 'params[files][0][sqon]=x', name: 'params sent as nested form fields' },
	{ form: 'params=%7B%7D&params=%7B%7D', name: 'params sent twice' },
];

suite('download', () => {
	suite('the ./download entry point', () => {
		test('exports InvalidExportRequestError, the class dataStream refuses invalid params with', async () => {
			// Given the class as the entry point exports it
			assert.equal(typeof InvalidExportRequestError, 'function');

			// When dataStream is given params that are not an object
			// Then it rejects with an instance of that very class
			await assert.rejects(
				() => dataStream({ ctx: {}, params: null }),
				(error) => error instanceof InvalidExportRequestError,
			);
		});
	});

	suite("the router's /download route, with no filter configured", () => {
		let arranger;

		before(async () => {
			arranger = await startArranger();
		});
		after(() => arranger.close());
		beforeEach(() => arranger.engine.reset());

		test('answers every document as a TSV attachment, header row first, one row per document', async () => {
			// Given a router with no filter over eight documents
			// When the stock UI posts its download form
			const response = await postDownload(arranger.server, paramsWithFile());

			// Then the whole index arrives as a plain-text attachment named after the file
			assert.equal(response.status, 200);
			assert.match(response.headers['content-type'] ?? '', /^text\/plain/);
			assert.deepEqual(parseContentDisposition(response.headers['content-disposition']), {
				dispositionType: 'attachment',
				fileName: 'donors.tsv',
			});
			assert.equal(response.text, tsvOf(ALL_DONOR_IDS));
		});

		test('keeps every row, once and in order, when the export spans several pages', async () => {
			// Given a file that asks for pages of three
			// When it is downloaded
			const response = await postDownload(arranger.server, paramsWithFile({ chunkSize: 3 }));

			// Then the body is the same as a single-page export, over at least three requests
			assert.equal(response.status, 200);
			assert.ok(
				arranger.engine.requests.length >= 3,
				`expected several pages, got ${arranger.engine.requests.length}`,
			);
			assert.equal(response.text, tsvOf(ALL_DONOR_IDS));
		});

		test('answers an empty body, with no header row, when no document matches', async () => {
			// Given a client sqon no document satisfies
			// When it is downloaded
			const response = await postDownload(arranger.server, paramsWithFile({ sqon: inDonorIds(['DO_99']) }));

			// Then the export succeeds with nothing in it
			assert.equal(response.status, 200);
			assert.equal(response.text, '');
		});

		test('answers JSON lines, header object first, when the file asks for json', async () => {
			// Given a file whose fileType is json
			// When it is downloaded
			const response = await postDownload(
				arranger.server,
				paramsWithFile({ fileName: 'donors.json', fileType: 'json' }),
			);

			// Then each line is one JSON object, the header object first, and the body ends in a newline
			assert.equal(response.status, 200);
			assert.ok(response.text.endsWith('\n'));
			assert.deepEqual(
				response.text
					.split('\n')
					.filter(Boolean)
					.map((line) => JSON.parse(line)),
				[
					{ donor_id: 'Donor ID', study: 'Study' },
					...DOCUMENTS.map(({ _source }) => ({ donor_id: _source.donor_id, study: _source.study })),
				],
			);
		});
	});

	suite("applying the router's filter to downloads", () => {
		const studyA = restrictingFilter({ fieldName: 'study', values: ['A'] });

		test("exports only the documents the router's filter permits, on every page", async () => {
			await withArranger({ getServerSideFilter: studyA }, async ({ engine, server }) => {
				// Given a router restricted to study A
				// When the stock form asks for pages of two
				const response = await postDownload(server, paramsWithFile({ chunkSize: 2 }));

				// Then only the study A donors arrive, across several pages
				assert.equal(response.status, 200);
				assert.ok(engine.requests.length >= 2, `expected several pages, got ${engine.requests.length}`);
				assert.equal(response.text, tsvOf(STUDY_A_DONOR_IDS));
			});
		});

		test("exports no document when the router's filter denies everything", async () => {
			await withArranger({ getServerSideFilter: denyAllFilter('study') }, async ({ server }) => {
				// Given a router whose filter matches nothing
				// When the stock form is posted
				const response = await postDownload(server, paramsWithFile());

				// Then the export succeeds in the zero-row shape: an empty body, with no header row
				assert.equal(response.status, 200);
				assert.equal(response.text, '');
			});
		});

		test("narrows the router's filter by the client's sqon, never widening it", async () => {
			await withArranger({ getServerSideFilter: studyA }, async ({ server }) => {
				// Given a router restricted to study A, and a client asking for DO_01 to DO_03
				// When it is downloaded
				const response = await postDownload(
					server,
					paramsWithFile({ sqon: inDonorIds(['DO_01', 'DO_02', 'DO_03']) }),
				);

				// Then only the donors both permit arrive
				assert.equal(response.status, 200);
				assert.deepEqual(dataRowIdsOf(response.text), ['DO_01', 'DO_03']);
			});
		});

		test("evaluates the router's filter callback once per download, however many pages", async () => {
			const getServerSideFilter = mock.fn(studyA);

			await withArranger({ getServerSideFilter }, async ({ engine, server }) => {
				// Given a router whose study A filter counts its calls
				const callsBefore = getServerSideFilter.mock.callCount();

				// When one download asks for pages of one
				const response = await postDownload(server, paramsWithFile({ chunkSize: 1 }));

				// Then it took several pages, and the callback ran once
				assert.equal(response.status, 200);
				assert.equal(dataRowIdsOf(response.text).length, STUDY_A_DONOR_IDS.length);
				assert.ok(engine.requests.length >= STUDY_A_DONOR_IDS.length);
				assert.equal(getServerSideFilter.mock.callCount() - callsBefore, 1);
			});
		});
	});

	suite('fields a download ignores in params', () => {
		// A router restricted to study A with a configured limit of two rows. The client's sqon asks
		// for DO_03 to DO_08, which leaves DO_03, DO_05 and DO_07 under the filter, capped to two. Only
		// the router's own filter, row limit and index, applied with the client's sqon, yield DO_03 and
		// DO_05 from the router's index, so the rows match only when each of them holds.
		const routerOptions = {
			downloads: { allowCustomMaxRows: false, maxRows: 2 },
			getServerSideFilter: restrictingFilter({ fieldName: 'study', values: ['A'] }),
		};
		const clientSqon = inDonorIds(['DO_03', 'DO_04', 'DO_05', 'DO_06', 'DO_07', 'DO_08']);

		test('ignores ctx, getServerSideFilter and index placed inside the file', async () => {
			await withArranger(routerOptions, async ({ engine, server }) => {
				// Given a file carrying its own context, filter and index
				const params = paramsWithFile({
					ctx: CLIENT_CONTEXT,
					getServerSideFilter: null,
					index: 'other_index',
					sqon: clientSqon,
				});

				// When it is downloaded
				const response = await postDownload(server, params);

				// Then the router's filter, row limit and index all held
				assert.equal(response.status, 200);
				assert.deepEqual(dataRowIdsOf(response.text), ['DO_03', 'DO_05']);
				assert.ok(engine.requests.length > 0);
				assert.ok(engine.requests.every((searchRequest) => searchRequest.index === INDEX_NAME));
			});
		});

		test('ignores ctx, getServerSideFilter and index placed at the top level of params', async () => {
			await withArranger(routerOptions, async ({ engine, server }) => {
				// Given params carrying their own context, filter and index beside the file
				const params = paramsWithFile(
					{ sqon: clientSqon },
					{ ctx: CLIENT_CONTEXT, getServerSideFilter: 'includeEverything', index: 'other_index' },
				);

				// When it is downloaded
				const response = await postDownload(server, params);

				// Then the router's filter, row limit and index all held
				assert.equal(response.status, 200);
				assert.deepEqual(dataRowIdsOf(response.text), ['DO_03', 'DO_05']);
				assert.ok(engine.requests.length > 0);
				assert.ok(engine.requests.every((searchRequest) => searchRequest.index === INDEX_NAME));
			});
		});
	});

	suite('fields a download picks from the file', () => {
		let arranger;

		before(async () => {
			arranger = await startArranger({ downloads: { allowCustomMaxRows: true, maxRows: 100 } });
		});
		after(() => arranger.close());
		beforeEach(() => arranger.engine.reset());

		test("orders the rows by the file's sort", async () => {
			// Given a file sorted by age, oldest first
			const params = paramsWithFile({ sort: [{ fieldName: 'age', order: 'desc' }] });

			// When it is downloaded
			const response = await postDownload(arranger.server, params);

			// Then the rows arrive in that order
			const byAgeDescending = [...DOCUMENTS].sort((left, right) => right._source.age - left._source.age);
			assert.equal(response.status, 200);
			assert.deepEqual(
				dataRowIdsOf(response.text),
				byAgeDescending.map((document) => document._id),
			);
		});

		test('orders the rows by a sort entry in the shape the stock UI sends', async () => {
			// Given a file sorted by age, youngest first, as the stock UI names a column's order
			const params = paramsWithFile({ sort: [{ fieldName: 'age', order: 'asc' }] });

			// When it is downloaded
			const response = await postDownload(arranger.server, params);

			// Then the rows arrive in that order
			const byAgeAscending = [...DOCUMENTS].sort((left, right) => left._source.age - right._source.age);
			assert.equal(response.status, 200);
			assert.deepEqual(
				dataRowIdsOf(response.text),
				byAgeAscending.map((document) => document._id),
			);
		});

		test('reads a sort order in any case', async () => {
			// Given files sorting by age, oldest first, with the order named in upper and in mixed case
			// When each is downloaded
			const responses = await Promise.all(
				['DESC', 'Desc'].map((order) =>
					postDownload(arranger.server, paramsWithFile({ sort: [{ fieldName: 'age', order }] })),
				),
			);

			// Then each arrives oldest first
			const byAgeDescending = [...DOCUMENTS].sort((left, right) => right._source.age - left._source.age);
			responses.forEach((response) => {
				assert.equal(response.status, 200);
				assert.deepEqual(
					dataRowIdsOf(response.text),
					byAgeDescending.map((document) => document._id),
				);
			});
		});

		test('keeps the default order for an empty sort', async () => {
			// Given a file whose sort is an empty array
			// When it is downloaded
			const response = await postDownload(arranger.server, paramsWithFile({ sort: [] }));

			// Then every row arrives in the default order
			assert.equal(response.status, 200);
			assert.equal(response.text, tsvOf(ALL_DONOR_IDS));
		});

		test("fills an empty cell with the file's valueWhenEmpty", async () => {
			// Given a diagnosis column, which some donors lack, and a valueWhenEmpty of N/A
			const columns = [STOCK_COLUMNS[0], columnFor({ displayName: 'Diagnosis', fieldName: 'diagnosis' })];

			// When it is downloaded
			const response = await postDownload(arranger.server, paramsWithFile({ columns, valueWhenEmpty: 'N/A' }));

			// Then every donor without one shows N/A
			assert.equal(response.status, 200);
			assert.equal(
				response.text,
				'Donor ID\tDiagnosis\n' +
					DOCUMENTS.map(({ _source }) => `${_source.donor_id}\t${_source.diagnosis ?? 'N/A'}\n`).join(''),
			);
		});

		test("caps the rows at the file's maxRows when custom row limits are allowed", async () => {
			// Given a file asking for two rows, on a router allowing custom row limits
			// When it is downloaded
			const response = await postDownload(arranger.server, paramsWithFile({ maxRows: 2 }));

			// Then exactly the first two arrive
			assert.equal(response.status, 200);
			assert.equal(response.text, tsvOf(['DO_01', 'DO_02']));
		});

		test("pages by the file's chunkSize", async () => {
			// Given a file asking for pages of three
			// When it is downloaded
			const response = await postDownload(arranger.server, paramsWithFile({ chunkSize: 3 }));

			// Then no request asks for more than three, and every row still arrives
			assert.equal(response.status, 200);
			assert.ok(arranger.engine.requests.length >= 3);
			assert.ok(
				arranger.engine.requests.every(
					(searchRequest) => (searchRequest.size ?? searchRequest.body?.size) <= 3,
				),
			);
			assert.equal(response.text, tsvOf(ALL_DONOR_IDS));
		});

		test('pages by a top-level chunkSize when the file names none', async () => {
			// Given params asking for pages of three beside a file that names no chunkSize
			// When it is downloaded
			const response = await postDownload(arranger.server, paramsWithFile({}, { chunkSize: 3 }));

			// Then no request asks for more than three, and every row still arrives
			assert.equal(response.status, 200);
			assert.ok(arranger.engine.requests.length >= 3);
			assert.ok(
				arranger.engine.requests.every(
					(searchRequest) => (searchRequest.size ?? searchRequest.body?.size) <= 3,
				),
			);
			assert.equal(response.text, tsvOf(ALL_DONOR_IDS));
		});

		test("expands rows by the file's uniqueBy path, in the shape the formatter has always written", async () => {
			// Given a file of DO_01 to DO_03 exported one row per file held
			const columns = [STOCK_COLUMNS[0], columnFor({ displayName: 'File ID', fieldName: 'files.file_id' })];
			const params = paramsWithFile({
				columns,
				sqon: inDonorIds(['DO_01', 'DO_02', 'DO_03']),
				uniqueBy: 'files.hits.edges[].node.file_id',
			});

			// When it is downloaded
			const response = await postDownload(arranger.server, params);

			// Then DO_01's two rows share one comma-joined line, and DO_02, holding none, a bare newline
			assert.equal(response.status, 200);
			assert.equal(response.text, 'Donor ID\tFile ID\nDO_01\tFL_01a,DO_01\tFL_01b\n\nDO_03\tFL_03\n');
		});

		for (const [description, fileType] of [
			['absent', undefined],
			['null', null],
			['empty', ''],
		]) {
			test(`answers TSV when the file's fileType is ${description}`, async () => {
				// Given a file whose fileType is absent, null or empty
				const file = { ...fileWithout('fileType'), ...(fileType === undefined ? {} : { fileType }) };

				// When it is downloaded
				const response = await postDownload(arranger.server, paramsWithFiles([file]));

				// Then the body is the stock TSV
				assert.equal(response.status, 200);
				assert.equal(response.text, tsvOf(ALL_DONOR_IDS));
			});
		}

		for (const [description, fileType] of [
			['null', null],
			['empty', ''],
		]) {
			test(`answers TSV when the top-level fileType is ${description} and the file names none`, async () => {
				// Given params whose top-level fileType is null or empty, beside a file that names none
				const params = { fileName: '', fileType, files: [fileWithout('fileType')] };

				// When it is downloaded
				const response = await postDownload(arranger.server, params);

				// Then the body is the stock TSV
				assert.equal(response.status, 200);
				assert.equal(response.text, tsvOf(ALL_DONOR_IDS));
			});
		}

		test('answers JSON lines when only the top-level fileType asks for json', async () => {
			// Given params asking for json beside a file that names no fileType
			const params = { fileName: '', fileType: 'json', files: [fileWithout('fileType')] };

			// When it is downloaded
			const response = await postDownload(arranger.server, params);

			// Then the header line is the JSON header object
			assert.equal(response.status, 200);
			assert.deepEqual(JSON.parse(response.text.split('\n')[0]), { donor_id: 'Donor ID', study: 'Study' });
		});
	});

	suite('naming the attachment', () => {
		let arranger;

		before(async () => {
			arranger = await startArranger();
		});
		after(() => arranger.close());

		const attachmentNameFor = async (params) => {
			const response = await postDownload(arranger.server, params);
			assert.equal(response.status, 200);
			assert.equal(rawHeaderCount(response, 'content-disposition'), 1);

			const { dispositionType, fileName } = parseContentDisposition(response.headers['content-disposition']);
			assert.equal(dispositionType, 'attachment');
			return fileName;
		};

		test("uses the file's fileName ahead of a top-level one", async () => {
			// Given both a file name and a top-level name
			// When it is downloaded, Then the file's own name wins
			assert.equal(
				await attachmentNameFor(paramsWithFile({ fileName: 'donors.tsv' }, { fileName: 'cohort.tsv' })),
				'donors.tsv',
			);
		});

		test('uses a top-level fileName when the file names none', async () => {
			// Given only a top-level name
			// When it is downloaded, Then that name is used
			assert.equal(
				await attachmentNameFor({ fileName: 'cohort.tsv', files: [fileWithout('fileName')] }),
				'cohort.tsv',
			);
		});

		test('uses a top-level fileName when the file names itself with an empty string', async () => {
			// Given a file whose own name is empty, beside a top-level name
			// When it is downloaded, Then the empty name counts as none, and the top-level name is used
			assert.equal(
				await attachmentNameFor(paramsWithFile({ fileName: '' }, { fileName: 'cohort.tsv' })),
				'cohort.tsv',
			);
		});

		test('falls back to file.<fileType> when no name is given', async () => {
			// Given a file with no name, beside no top-level name, an empty one, and a json fileType
			// When each is downloaded, Then each gets the default name for its type
			assert.equal(await attachmentNameFor({ files: [fileWithout('fileName')] }), 'file.tsv');
			assert.equal(await attachmentNameFor({ fileName: '', files: [fileWithout('fileName')] }), 'file.tsv');
			assert.equal(await attachmentNameFor(paramsWithFile({ fileName: '' })), 'file.tsv');
			assert.equal(
				await attachmentNameFor({ files: [{ ...fileWithout('fileName'), fileType: 'json' }] }),
				'file.json',
			);
		});

		for (const fileName of [
			'donors; cohort.tsv',
			'donors "cohort".tsv',
			'donors\\cohort.tsv',
			'donors%20cohort.tsv',
			'données cohorte ✓.tsv',
			'donors.tsv; filename=cohort.tsv',
		]) {
			test(`keeps the name ${JSON.stringify(fileName)} intact in a header that parses back to it`, async () => {
				// Given a file name that needs encoding to travel in a header
				// When it is downloaded, Then the one Content-Disposition header parses back to exactly that name
				assert.equal(await attachmentNameFor(paramsWithFile({ fileName })), fileName);
			});
		}

		for (const fileName of ['donors.tsv\r\ncohort.tsv', 'donors.tsv\ncohort.tsv', 'donors.tsv\rcohort.tsv']) {
			test(`serves the whole export, with the headers a plain name gets, for the name ${JSON.stringify(fileName)}`, async () => {
				// Given a file name holding a line break, and the headers a download under a plain name carries
				const plainResponse = await postDownload(arranger.server, paramsWithFile({ fileName: 'donors.tsv' }));

				// When it is downloaded
				const response = await postDownload(arranger.server, paramsWithFile({ fileName }));

				// Then the export is served whole, under one attachment header that parses back to the name,
				// and with exactly the header names the plain name's download carries
				assert.equal(response.status, 200);
				assert.equal(rawHeaderCount(response, 'content-disposition'), 1);
				assert.deepEqual(parseContentDisposition(response.headers['content-disposition']), {
					dispositionType: 'attachment',
					fileName,
				});
				assert.deepEqual(Object.keys(response.headers).sort(), Object.keys(plainResponse.headers).sort());
				assert.equal(response.text, tsvOf(ALL_DONOR_IDS));
			});
		}
	});

	suite('refusing invalid params at the route', () => {
		let arranger;

		before(async () => {
			arranger = await startArranger();
		});
		after(() => arranger.close());

		const assertRefusedWhereTheStockDownloadSucceeds = (sendInvalid) =>
			runWatchingForProcessFaults(async () => {
				// Given a router where the stock download succeeds
				const control = await postDownload(arranger.server, paramsWithFile());
				assert.equal(control.status, 200, 'the stock download should succeed');
				const requestsBefore = arranger.engine.requests.length;

				// When the invalid request is sent
				const response = await sendInvalid();

				// Then it is refused with fixed plain text before any engine request, and the server keeps serving
				assertPlainTextError(response, 400);
				assert.equal(arranger.engine.requests.length, requestsBefore, 'no engine request should be made');
				assert.equal((await request(arranger.server).get('/alive')).status, 200);
			});

		for (const { name, params } of INVALID_PARAMS) {
			test(`answers 400 with fixed text for ${name}`, () =>
				assertRefusedWhereTheStockDownloadSucceeds(() => postDownload(arranger.server, params)));
		}

		for (const { form, name } of INVALID_FORMS) {
			test(`answers 400 with fixed text for ${name}`, () =>
				assertRefusedWhereTheStockDownloadSucceeds(() => postForm(arranger.server, form)));
		}

		test('answers the same text for an invalid chunkSize, whatever the value', async () => {
			// Given three different invalid chunkSize values
			// When each is downloaded
			const responses = await Promise.all(
				[0, -1, CLIENT_TEXT].map((chunkSize) => postDownload(arranger.server, paramsWithFile({ chunkSize }))),
			);

			// Then each is refused with the same text
			responses.forEach((response) => assertPlainTextError(response, 400));
			assert.equal(new Set(responses.map((response) => response.text)).size, 1);
		});

		// A client sqon the compiler refuses is invalid input like any other, so it is answered as one.
		const studyClause = { content: { fieldName: 'study', value: ['A'] }, op: 'in' };
		for (const [description, sqon] of [
			['a pivot naming no nested field', { content: [studyClause], op: 'and', pivot: CLIENT_TEXT }],
			['an op the compiler does not know', { content: studyClause.content, op: CLIENT_TEXT }],
			['a combination holding a string where a clause belongs', { content: [CLIENT_TEXT], op: 'and' }],
		]) {
			test(`answers 400 with fixed text for a client sqon with ${description}`, () =>
				assertRefusedWhereTheStockDownloadSucceeds(() =>
					postDownload(arranger.server, paramsWithFile({ sqon })),
				));
		}
	});

	suite('dataStream validating params itself', () => {
		let arranger;
		let ctx;

		before(async () => {
			arranger = await startArranger();
			ctx = await arranger.captureContext();
		});
		after(() => arranger.close());

		for (const { name, params } of INVALID_PARAMS) {
			test(`rejects ${name} before any output or engine request`, () =>
				runWatchingForProcessFaults(async () => {
					// Given a request context where dataStream with the stock params yields rows
					const control = await dataStream({ ctx, params: paramsWithFile() });
					assert.ok((await readOutput(control.output)).length > 1, 'the stock params should yield rows');
					const requestsBefore = arranger.engine.requests.length;

					// When dataStream is given the invalid params
					// Then it rejects without repeating the client's text, and makes no engine request
					await assert.rejects(
						async () => dataStream({ ctx, params }),
						(error) => {
							assert.ok(error instanceof Error, 'the refusal should be an Error');
							assert.ok(
								!error.message.includes(CLIENT_TEXT),
								`the message should not quote the client: ${error.message}`,
							);
							return true;
						},
					);
					assert.equal(arranger.engine.requests.length, requestsBefore, 'no engine request should be made');
				}));
		}
	});

	suite('server faults at the route', () => {
		test('answers 500 with the same fixed text whatever the engine reported, logging the detail', async () => {
			const answers = [];

			for (const failureMessage of [
				'index [donor_internal_7] is closed',
				'shard [donor_internal_9][0] is unavailable',
			]) {
				await withArranger({ failOnRequest: 1, failureMessage }, async ({ server }) => {
					// Given an engine that fails the first search with a message naming an internal index
					const consoleCapture = captureConsole();

					try {
						// When the stock form is posted
						const response = await postDownload(server, paramsWithFile());

						// Then it answers 500 in fixed plain text, and the detail reaches only the server log
						assertPlainTextError(response, 500, ['donor_internal']);
						assert.ok(
							consoleCapture.loggedText().includes(failureMessage),
							'the engine failure should be logged server-side',
						);
						answers.push(response.text);
					} finally {
						consoleCapture.restore();
					}
				});
			}

			assert.equal(answers[0], answers[1], 'the text should not depend on what the engine reported');
		});

		test('answers 500 when the first page reports a failed shard', async () => {
			await withArranger({ shardFailureOnRequest: 1 }, async ({ server }) => {
				// Given an engine whose first response reports a failed shard, beside the hits it did find
				// When the stock form is posted
				const response = await postDownload(server, paramsWithFile());

				// Then it answers 500 rather than exporting a partial result
				assertPlainTextError(response, 500, ['DO_01']);
			});
		});

		for (const [description, getServerSideFilter] of [
			[
				'throws',
				() => {
					throw new Error('token service unreachable at 10.0.0.5');
				},
			],
			['returns a promise', () => Promise.resolve({ content: { fieldName: 'study', value: ['A'] }, op: 'in' })],
		]) {
			test(`answers 500 with fixed text, before any engine request, when the filter callback ${description}`, async () => {
				await withArranger({ getServerSideFilter }, async ({ engine, server }) => {
					// Given a router whose filter callback fails as named
					const consoleCapture = captureConsole();

					try {
						// When the stock form is posted
						const response = await postDownload(server, paramsWithFile());

						// Then it answers 500 in fixed plain text, without searching
						assertPlainTextError(response, 500, ['10.0.0.5']);
						assert.equal(engine.requests.length, 0);

						if (description === 'throws') {
							assert.ok(
								consoleCapture.loggedText().includes('10.0.0.5'),
								'the callback failure should be logged server-side',
							);
						}
					} finally {
						consoleCapture.restore();
					}
				});
			});
		}
	});

	suite('stream failures at the route', () => {
		const dateColumn = (overrides = {}) =>
			columnFor({ displayName: 'Diagnosed', fieldName: 'diagnosis_date', type: 'date', ...overrides });

		for (const [description, engineOptions] of [
			['rejects its third search', { failOnRequest: 3 }],
			['reports a failed shard on its third search', { shardFailureOnRequest: 3 }],
		]) {
			test(`ends the response with an error when the engine ${description}`, async () => {
				await withArranger(engineOptions, async (arranger) => {
					await runWatchingForProcessFaults(async () => {
						// Given an engine that fails as named, after two healthy pages
						// When the stock form asks for pages of two
						const result = await settle(postDownload(arranger.server, paramsWithFile({ chunkSize: 2 })));
						await waitForEngineToSettle(arranger.engine.requests);

						// Then the response is aborted or an error, no request follows the failed one, and the server keeps serving
						assertNotACompleteSuccess(result);
						assert.equal(arranger.engine.requests.length, 3);
						await assertStillServing(arranger);
					});
				});
			});
		}

		test('ends the response with an error and stops paging when a value on a later page cannot be formatted', async () => {
			// Given DO_05's date is a number too large to be a date, so the third page cannot be formatted,
			// and an engine holding every search from the fourth on
			const documents = DOCUMENTS.map((document) =>
				document._id === 'DO_05'
					? { ...document, _source: { ...document._source, diagnosis_date: '99999999999999999999' } }
					: document,
			);

			await withArranger({ documents, holdFromRequest: 4 }, async (arranger) => {
				await runWatchingForProcessFaults(async () => {
					// When the date column is exported in pages of two, and the engine is released once the response has ended
					const params = paramsWithFile({ chunkSize: 2, columns: [...STOCK_COLUMNS, dateColumn()] });
					const result = await settle(postDownload(arranger.server, params));
					await pause(50);
					const requestedBeforeRelease = arranger.engine.requests.length;
					arranger.engine.release();
					await waitForEngineToSettle(arranger.engine.requests);

					// Then the response is aborted or an error, no search starts after it, and the server keeps serving
					assertNotACompleteSuccess(result, ['Invalid time value']);
					assert.equal(
						arranger.engine.requests.length,
						requestedBeforeRelease,
						'no page should be requested once the response has failed',
					);
					await assertStillServing(arranger);
				});
			});
		});

		test('answers 500 with fixed text when the first row cannot be formatted', async () => {
			await withArranger({}, async (arranger) => {
				await runWatchingForProcessFaults(async () => {
					// Given a date column whose display format the formatter cannot apply
					const params = paramsWithFile({
						columns: [...STOCK_COLUMNS, dateColumn({ displayFormat: 'ffff' })],
					});
					const consoleCapture = captureConsole();

					try {
						// When it is exported
						const result = await settle(postDownload(arranger.server, params));

						// Then nothing has reached the client yet, so it is a server fault: 500 in fixed plain text
						assert.equal(result.outcome, 'response', `expected an answer, got ${result.outcome}`);
						assertPlainTextError(result.response, 500, ['unescaped', 'Donor ID']);
					} finally {
						consoleCapture.restore();
					}

					await assertStillServing(arranger);
				});
			});
		});

		// Properties the contract sets no rule for. Whatever the answer, the server keeps serving.
		for (const [description, fileOverrides] of [
			['a column whose jsonPath is a number', { columns: [{ ...STOCK_COLUMNS[0], jsonPath: 5 }] }],
			[
				'a column with no fieldName, under a uniqueBy path',
				{
					columns: [{ accessor: 'donor_id', displayName: 'Donor ID' }],
					uniqueBy: 'files.hits.edges[].node.file_id',
				},
			],
		]) {
			test(`answers the request when the file carries ${description}`, async () => {
				await withArranger({}, async (arranger) => {
					await runWatchingForProcessFaults(async () => {
						// Given a file carrying a property of the wrong type
						const params = paramsWithFile(fileOverrides);
						const consoleCapture = captureConsole();

						try {
							// When it is exported
							const result = await settle(postDownload(arranger.server, params));

							// Then the request settles, and any error it answers is fixed plain text that does not carry the fault
							assert.notEqual(
								result.outcome,
								'hung',
								`the request should settle within ${SETTLE_TIMEOUT} ms`,
							);
							if (result.outcome === 'response' && result.response.status >= 400) {
								assertPlainTextError(result.response, result.response.status, [
									'TypeError',
									'is not a function',
									'Cannot read',
								]);
							}
						} finally {
							consoleCapture.restore();
						}

						// And the server keeps serving
						await assertStillServing(arranger);
					});
				});
			});
		}

		test('stops querying the engine once the client disconnects', async () => {
			// Given twenty documents exported one per page, with the engine holding every search after the first
			await withArranger(
				{ documents: generatedDocuments(20), holdFromRequest: 2 },
				async ({ engine, server }) => {
					await runWatchingForProcessFaults(async () => {
						// When the client disconnects once the first row has arrived, and the engine is released
						// after the server has had time to see the connection close
						const firstRows = await disconnectAfterFirstRow(server, paramsWithFile({ chunkSize: 1 }));
						await pause(100);
						const requestedBeforeRelease = engine.requests.length;
						engine.release();
						await waitForEngineToSettle(engine.requests);

						// Then no search starts after that: the held one, if any, is the last
						assert.equal(firstRows.status, 200);
						assert.ok(
							requestedBeforeRelease <= 2,
							`expected at most the held search, got ${requestedBeforeRelease}`,
						);
						const requestedAfterRelease = engine.requests.length - requestedBeforeRelease;
						assert.equal(
							requestedAfterRelease,
							0,
							`expected paging to stop, but ${requestedAfterRelease} more requests were made`,
						);
					});
				},
			);
		});
	});

	suite('dataStream for an integration route', () => {
		let arranger;
		let ctx;

		before(async () => {
			arranger = await startArranger();
			ctx = await arranger.captureContext();
		});
		after(() => arranger.close());

		test('yields the header row, then one TSV row string per hit, each ending in a newline', async () => {
			// Given the request context and a file of DO_01 to DO_03 in pages of two
			const params = paramsWithFile({ chunkSize: 2, sqon: inDonorIds(['DO_01', 'DO_02', 'DO_03']) });

			// When dataStream is called and its output read
			const { contentType, output, responseFileName } = await dataStream({ ctx, params });
			const chunks = await readOutput(output);

			// Then each chunk is one line, header first, and the file is named and typed for the route
			assert.deepEqual(chunks, [STOCK_HEADER, 'DO_01\tA\n', 'DO_02\tB\n', 'DO_03\tA\n']);
			assert.equal(contentType, 'text/plain');
			assert.equal(responseFileName, 'donors.tsv');
		});

		test('yields one JSON object string per hit, header object first, for fileType json', async () => {
			// Given a json file of DO_01 and DO_02
			const params = paramsWithFile({ fileType: 'json', sqon: inDonorIds(['DO_01', 'DO_02']) });

			// When dataStream is called and its output read
			const chunks = await readOutput((await dataStream({ ctx, params })).output);

			// Then each chunk is one JSON line
			assert.deepEqual(chunks, [
				'{"donor_id":"Donor ID","study":"Study"}\n',
				'{"donor_id":"DO_01","study":"A"}\n',
				'{"donor_id":"DO_02","study":"B"}\n',
			]);
		});

		test('yields nothing when no document matches', async () => {
			// Given a sqon no document satisfies
			// When dataStream is called and its output read
			const chunks = await readOutput(
				(await dataStream({ ctx, params: paramsWithFile({ sqon: inDonorIds(['DO_99']) }) })).output,
			);

			// Then the output ends with no chunk at all
			assert.deepEqual(chunks, []);
		});

		test('accepts a client object holding only files with index, sqon and columns', async () => {
			// Given the minimal client object an integration forwards whole
			const params = { files: [{ columns: STOCK_COLUMNS, index: 'model', sqon: null }] };

			// When dataStream is called and its output read
			const { output, responseFileName } = await dataStream({ ctx, params });
			const chunks = await readOutput(output);

			// Then every document arrives as TSV, under the default name
			assert.equal(chunks.join(''), tsvOf(ALL_DONOR_IDS));
			assert.equal(responseFileName, 'file.tsv');
		});
	});

	suite("dataStream applying the router's filter", () => {
		const studyA = restrictingFilter({ fieldName: 'study', values: ['A'] });
		const studyB = restrictingFilter({ fieldName: 'study', values: ['B'] });
		let arranger;
		let ctx;

		before(async () => {
			arranger = await startArranger({ getServerSideFilter: studyA });
			ctx = await arranger.captureContext();
		});
		after(() => arranger.close());

		test('applies the filter the router recorded on the request context, when the caller passes none', async () => {
			// Given the context of a router restricted to study A
			// When dataStream is called with the stock params and no filter
			const chunks = await readOutput((await dataStream({ ctx, params: paramsWithFile() })).output);

			// Then only study A donors arrive
			assert.equal(chunks.join(''), tsvOf(STUDY_A_DONOR_IDS));
		});

		for (const [description, params] of [
			['a filter function inside the file', paramsWithFile({ getServerSideFilter: studyB })],
			['a null filter inside the file', paramsWithFile({ getServerSideFilter: null })],
			['a SQON in place of a filter inside the file', paramsWithFile({ getServerSideFilter: studyB() })],
			['a context inside the file', paramsWithFile({ ctx: CLIENT_CONTEXT })],
			['a filter function at the top level of params', paramsWithFile({}, { getServerSideFilter: studyB })],
			['a context at the top level of params', paramsWithFile({}, { ctx: CLIENT_CONTEXT })],
		]) {
			test(`ignores ${description}`, async () => {
				// Given the study A router's context, and params carrying a field it must not use
				// When dataStream is called
				const chunks = await readOutput((await dataStream({ ctx, params })).output);

				// Then exactly the study A donors arrive: neither replaced, combined, nor refused
				assert.equal(chunks.join(''), tsvOf(STUDY_A_DONOR_IDS));
			});
		}

		test("evaluates the router's filter once however many pages", async () => {
			const getServerSideFilter = mock.fn(studyA);

			await withArranger({ getServerSideFilter }, async (counting) => {
				// Given the context of a router whose study A filter counts its calls
				const countingContext = await counting.captureContext();
				const callsBefore = getServerSideFilter.mock.callCount();

				// When dataStream exports one row per page
				const chunks = await readOutput(
					(await dataStream({ ctx: countingContext, params: paramsWithFile({ chunkSize: 1 }) })).output,
				);

				// Then it took several pages, and the callback ran once
				assert.equal(chunks.join(''), tsvOf(STUDY_A_DONOR_IDS));
				assert.ok(counting.engine.requests.length >= STUDY_A_DONOR_IDS.length);
				assert.equal(getServerSideFilter.mock.callCount() - callsBefore, 1);
			});
		});
	});

	suite('dataStream failures', () => {
		for (const [description, engineOptions] of [
			['rejects its second search', { failOnRequest: 2 }],
			['reports a failed shard on its second search', { shardFailureOnRequest: 2 }],
		]) {
			test(`emits an error from its output when the engine ${description}`, async () => {
				await withArranger(engineOptions, async (arranger) => {
					await runWatchingForProcessFaults(async () => {
						// Given an engine that fails as named, after one healthy page
						const ctx = await arranger.captureContext();

						// When dataStream exports in pages of two
						const { output } = await dataStream({ ctx, params: paramsWithFile({ chunkSize: 2 }) });
						const result = await settleOutput(output);

						// Then the output errors, rather than ending or hanging
						assert.equal(result.outcome, 'errored');
					});
				});
			});
		}

		for (const [description, engineOptions] of [
			['rejects', { failOnRequest: 2 }],
			['reports a failed shard', { shardFailureOnRequest: 2 }],
		]) {
			test(`reports a failure when the engine ${description} on the first page, never ending normally`, async () => {
				await withArranger(engineOptions, async (arranger) => {
					await runWatchingForProcessFaults(async () => {
						// Given a context where one single-page export succeeds, and an engine failing as named on the next search
						const ctx = await arranger.captureContext();
						assert.equal(
							(await readOutput((await dataStream({ ctx, params: paramsWithFile() })).output)).join(''),
							tsvOf(ALL_DONOR_IDS),
						);
						assert.equal(arranger.engine.requests.length, 1, 'the control export should take one search');

						// When dataStream exports again, so its first page is the failing search
						const result = await settleDataStream(() => dataStream({ ctx, params: paramsWithFile() }));

						// Then the call rejects or the output errors, and no row is delivered
						assert.ok(
							['errored', 'rejected'].includes(result.outcome),
							`expected a failure, got ${result.outcome}`,
						);
						assert.ok(!(result.chunks ?? []).join('').includes('DO_'), 'no row should be delivered');
					});
				});
			});
		}

		test('requests nothing further once the integration destroys its output', async () => {
			// Given twenty documents exported one per page, with the engine holding every search after the first
			await withArranger({ documents: generatedDocuments(20), holdFromRequest: 2 }, async (arranger) => {
				await runWatchingForProcessFaults(async () => {
					const ctx = await arranger.captureContext();
					const { output } = await dataStream({ ctx, params: paramsWithFile({ chunkSize: 1 }) });
					output.on('error', () => {});

					// When the integration destroys the output on its first chunk, as a closed response would,
					// and the engine is released once any search already under way has had time to start
					await new Promise((resume) =>
						output.once('data', () => {
							output.destroy();
							resume();
						}),
					);
					await pause(20);
					const requestedBeforeRelease = arranger.engine.requests.length;
					arranger.engine.release();
					await waitForEngineToSettle(arranger.engine.requests);

					// Then no search starts after that: the held one, if any, is the last
					assert.ok(
						requestedBeforeRelease <= 2,
						`expected at most the held search, got ${requestedBeforeRelease}`,
					);
					assert.equal(
						arranger.engine.requests.length - requestedBeforeRelease,
						0,
						'no page should be requested once the output is destroyed',
					);
				});
			});
		});

		test('emits an error from its output when a value on a later page cannot be formatted', async () => {
			const documents = DOCUMENTS.map((document) =>
				document._id === 'DO_05'
					? { ...document, _source: { ...document._source, diagnosis_date: '99999999999999999999' } }
					: document,
			);

			await withArranger({ documents }, async (arranger) => {
				await runWatchingForProcessFaults(async () => {
					// Given DO_05's date cannot be formatted
					const ctx = await arranger.captureContext();
					const columns = [
						...STOCK_COLUMNS,
						columnFor({ displayName: 'Diagnosed', fieldName: 'diagnosis_date', type: 'date' }),
					];

					// When dataStream exports the date column in pages of two
					const { output } = await dataStream({ ctx, params: paramsWithFile({ chunkSize: 2, columns }) });
					const result = await settleOutput(output);

					// Then the output errors, without an uncaught exception
					assert.equal(result.outcome, 'errored');
				});
			});
		});

		test('reports a failure when the first row cannot be formatted, never ending normally', async () => {
			await withArranger({}, async (arranger) => {
				await runWatchingForProcessFaults(async () => {
					// Given a context where the stock params export, and a date column whose display format the formatter cannot apply
					const ctx = await arranger.captureContext();
					assert.ok(
						(await readOutput((await dataStream({ ctx, params: paramsWithFile() })).output)).length > 1,
					);
					const columns = [
						...STOCK_COLUMNS,
						columnFor({
							displayFormat: 'ffff',
							displayName: 'Diagnosed',
							fieldName: 'diagnosis_date',
							type: 'date',
						}),
					];

					// When dataStream exports that column
					const result = await settleDataStream(() =>
						dataStream({ ctx, params: paramsWithFile({ columns }) }),
					);

					// Then the call rejects or the output errors
					assert.ok(
						['errored', 'rejected'].includes(result.outcome),
						`expected a failure, got ${result.outcome}`,
					);
				});
			});
		});

		test('does not request further pages while its output is unread', async () => {
			const documents = generatedDocuments(200);

			await withArranger(
				{ documents, downloads: { allowCustomMaxRows: false, maxRows: 0 } },
				async (arranger) => {
					// Given 200 documents with no row limit, and an integration that has not started reading
					const ctx = await arranger.captureContext();
					const { output } = await dataStream({ ctx, params: paramsWithFile({ chunkSize: 1 }) });

					// When the export is left alone until the engine falls quiet
					await waitForEngineToSettle(arranger.engine.requests);
					const requestedBeforeReading = arranger.engine.requests.length;

					// Then it has paused well short of the end, and reading then delivers every row
					assert.ok(
						requestedBeforeReading < 100,
						`expected the export to pause, but it made ${requestedBeforeReading} requests`,
					);
					const chunks = await readOutput(output);
					assert.equal(
						chunks.join(''),
						tsvOf(
							documents.map((document) => document._id),
							documents,
						),
					);
				},
			);
		});
	});
});
