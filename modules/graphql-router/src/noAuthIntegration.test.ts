import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';

import type { GetServerSideFilterFn } from '@overture-stack/arranger-types/configs';
import express, { json, urlencoded, type Request, type Response } from 'express';
import request from 'supertest';

import { restrictingFilter } from './accessControl/serverSideFilters.fixture.js';
import { dataStream } from './download/index.js';
import arrangerRouter, { utils, wrapOpenSearchClient } from './index.js';

/*
 * The two integration patterns a deployment with no access control relies on, exercised end to end
 * over HTTP. Neither passes a filter anywhere: not to the router, not to the export functions. They
 * must keep working unchanged, with exactly the rows and output shapes they get today.
 *
 * Pattern A: the router's own `POST /download`, as the stock UI posts it.
 * Pattern B: an application mounts the router at its root with an injected search client, then
 * mounts its own export route after it, handing `req.context` whole to `utils.getAllData` and to the
 * `./download` subpath's `dataStream`.
 *
 * A last suite runs the same wiring with a restricting filter configured on the router. Every row a
 * no-auth test expects is also what an export path that ignores access control altogether would
 * return, so without that suite these tests could not tell the router's defaulted decision apart
 * from an export that never consults it.
 */

type StoredDocument = { _id: string; _source: Record<string, unknown> };
type SearchParams = { body?: Record<string, unknown>; from?: number; index?: string | string[]; size?: number };
type RequestWithContext = Request & { context?: Record<string, unknown> };
type ExportChunk = { hits: unknown[]; total: unknown };

const CONFIGURED_INDEX = 'model-records';
const DOCUMENT_TYPE = 'model';
const APPLICATION_FIELD_VALUE = 'set-by-the-application-before-the-router';

/** The index a Pattern B client names in its payload. It is not the router's, and must never be searched. */
const CLIENT_NAMED_INDEX = 'model';

/**
 * Stored deliberately out of `_id` order, so a test expecting `_id` order cannot pass on storage
 * order. Names sort differently again ("Model One", "Model Three", "Model Two"), and one document
 * has no study, so an empty cell is part of the expected output.
 */
const STORED_DOCUMENTS: StoredDocument[] = [
	{ _id: 'MO_03', _source: { name: 'Model Three', study: 'STUDY-A' } },
	{ _id: 'MO_01', _source: { name: 'Model One', study: 'STUDY-A' } },
	{ _id: 'MO_02', _source: { name: 'Model Two' } },
];

const SOURCES_IN_ID_ORDER = [
	{ name: 'Model One', study: 'STUDY-A' },
	{ name: 'Model Two' },
	{ name: 'Model Three', study: 'STUDY-A' },
];

/**
 * Selects the document with no study beside one with a study, so no plausible study restriction
 * could select the same rows and make a narrowing test pass for the wrong reason.
 */
const NAMED_MODELS_SQON = {
	op: 'and',
	content: [{ op: 'in', content: { fieldName: 'name', value: ['Model One', 'Model Two'] } }],
};

/** Names no stored document, so the export has zero rows to give. */
const NO_MATCH_SQON = {
	op: 'and',
	content: [{ op: 'in', content: { fieldName: 'name', value: ['No Such Model'] } }],
};

/**
 * Client filters that restrict nothing, each of which must export every row exactly as `null`
 * does. `undefined` stands for a payload that leaves the key out: JSON drops it on the way.
 */
const UNRESTRICTING_SQONS: [string, unknown][] = [
	['absent', undefined],
	['an empty object', {}],
	['an empty "and" combination', { op: 'and', content: [] }],
];

/** Column descriptors as the stock UI sends them: whole column objects, not field names. */
const STOCK_COLUMNS = [
	{
		accessor: 'name',
		canChangeShow: true,
		displayName: 'Name',
		fieldName: 'name',
		isArray: false,
		jsonPath: null,
		query: null,
		show: true,
		sortable: true,
		type: 'keyword',
	},
	{
		accessor: 'study',
		canChangeShow: true,
		displayName: 'Study',
		fieldName: 'study',
		isArray: false,
		jsonPath: null,
		query: null,
		show: true,
		sortable: true,
		type: 'keyword',
	},
];

/** Today's TSV for every stored document: header first, `_id` order, the default `--` for an empty cell. */
const EVERY_ROW_TSV_CHUNKS = ['Name\tStudy\n', 'Model One\tSTUDY-A\n', 'Model Two\t--\n', 'Model Three\tSTUDY-A\n'];

/** The TSV for the two documents NAMED_MODELS_SQON selects. */
const NAMED_MODELS_TSV_CHUNKS = ['Name\tStudy\n', 'Model One\tSTUDY-A\n', 'Model Two\t--\n'];

/**
 * Permits the study-A documents (Model One and Model Three). That differs from every row, from the
 * rows NAMED_MODELS_SQON selects, and from their intersection (Model One alone), so a test under it
 * can tell a dropped filter, a replaced client filter and a correctly composed one apart.
 */
const STUDY_A_FILTER = restrictingFilter({ fieldName: 'study', values: ['STUDY-A'] });
const STUDY_A_TSV_CHUNKS = ['Name\tStudy\n', 'Model One\tSTUDY-A\n', 'Model Three\tSTUDY-A\n'];

const valuesAt = (document: StoredDocument, fieldName: string): unknown[] => {
	const value = fieldName === '_id' ? document._id : document._source[fieldName];

	return (Array.isArray(value) ? value : [value]).filter((each) => each !== undefined && each !== null);
};

const asClauseList = (clauses: unknown): Record<string, unknown>[] =>
	clauses === undefined ? [] : ((Array.isArray(clauses) ? clauses : [clauses]) as Record<string, unknown>[]);

/**
 * Evaluates the subset of the query language Arranger compiles a flat keyword SQON into, so a test
 * asserts on the rows a query selects rather than on its shape. Anything outside that subset throws,
 * so an unexpected query fails the test loudly instead of selecting everything.
 */
const documentMatches = (clause: Record<string, unknown> | undefined, document: StoredDocument): boolean => {
	if (clause === undefined || Object.keys(clause).length === 0) {
		return true;
	}

	const [kind, ...otherKinds] = Object.keys(clause);

	if (kind === undefined || otherKinds.length > 0) {
		throw new Error(`stub search engine expects exactly one clause kind per object, got ${JSON.stringify(clause)}`);
	}

	const body = clause[kind] as Record<string, unknown>;

	switch (kind) {
		case 'bool': {
			const { boost: _boost, filter, minimum_should_match, must, must_not, should, ...unsupported } = body;

			if (Object.keys(unsupported).length > 0) {
				throw new Error(`stub search engine cannot evaluate bool keys ${Object.keys(unsupported).join(', ')}`);
			}

			const requiredClauses = [...asClauseList(must), ...asClauseList(filter)];
			const optionalClauses = asClauseList(should);
			const minimumOptionalMatches =
				typeof minimum_should_match === 'number'
					? minimum_should_match
					: requiredClauses.length === 0 && optionalClauses.length > 0
						? 1
						: 0;

			return (
				requiredClauses.every((each) => documentMatches(each, document)) &&
				!asClauseList(must_not).some((each) => documentMatches(each, document)) &&
				optionalClauses.filter((each) => documentMatches(each, document)).length >= minimumOptionalMatches
			);
		}

		case 'terms':
		case 'term': {
			const { boost: _boost, ...fields } = body;
			const [fieldName, ...otherFields] = Object.keys(fields);

			if (fieldName === undefined || otherFields.length > 0) {
				throw new Error(`stub search engine expects one field per ${kind} clause, got ${JSON.stringify(body)}`);
			}

			const wanted = fields[fieldName];
			const wantedValues = (
				kind === 'terms' ? (wanted as unknown[]) : [(wanted as { value?: unknown })?.value ?? wanted]
			).map(String);

			return valuesAt(document, fieldName).some((value) => wantedValues.includes(String(value)));
		}

		case 'match_all':
			return true;

		default:
			throw new Error(`stub search engine cannot evaluate a "${kind}" clause`);
	}
};

/**
 * Stands in for an OpenSearch client: answers the alias and mapping lookups the router makes at
 * construction, and answers every search by evaluating its query over the stored documents, in
 * `_id` order, honouring `size`, `from` and an `_id` `search_after`. Records every search.
 *
 * Holds the configured index and no other, as a real cluster would: a search naming any other
 * index, or none, is refused the way the engine refuses a missing index, so an export that searched
 * the index a client named fails rather than quietly reading the same documents.
 */
const createSearchEngine = (documents: StoredDocument[]) => {
	const searches: SearchParams[] = [];
	// Byte order, as the engine sorts a keyword and as the `search_after` comparison below assumes.
	const documentsInIdOrder = [...documents].sort((first, second) => (first._id < second._id ? -1 : 1));

	const search = async (params: SearchParams) => {
		searches.push(structuredClone(params));

		const searchedIndices = params.index === undefined ? [] : [params.index].flat();
		if (searchedIndices.length === 0 || searchedIndices.some((index) => index !== CONFIGURED_INDEX)) {
			throw new Error(
				`index_not_found_exception: no such index [${searchedIndices.join(',') || '(none named)'}]`,
			);
		}

		const { from = 0, size: topLevelSize } = params;
		const body = params.body ?? {};
		const {
			query,
			search_after: searchAfter,
			size: bodySize,
			sort,
		} = body as {
			query?: Record<string, unknown>;
			search_after?: unknown[];
			size?: number;
			sort?: (Record<string, unknown> | string)[];
		};

		const unsupportedSort = (sort ?? [])
			.flatMap((entry) => (typeof entry === 'string' ? [entry] : Object.keys(entry)))
			.filter((fieldName) => fieldName !== '_id');
		if (unsupportedSort.length > 0) {
			throw new Error(`stub search engine sorts only by _id, was asked for ${unsupportedSort.join(', ')}`);
		}

		const matching = documentsInIdOrder.filter((document) => documentMatches(query, document));
		const lastSeenId = searchAfter?.[0];
		const afterCursor =
			lastSeenId === undefined ? matching : matching.filter((document) => document._id > String(lastSeenId));
		const pageSize = topLevelSize ?? bodySize ?? 10;
		const page = afterCursor.slice(from, from + pageSize);

		return {
			body: {
				_shards: { failed: 0, successful: 1, total: 1 },
				hits: {
					hits: page.map((document) => ({
						_id: document._id,
						_index: CONFIGURED_INDEX,
						_source: structuredClone(document._source),
						sort: [document._id],
					})),
					total: { relation: 'eq', value: matching.length },
				},
				timed_out: false,
				took: 1,
			},
			statusCode: 200,
		};
	};

	const openSearchClient = {
		cat: { aliases: async () => ({ body: [], statusCode: 200 }) },
		indices: {
			getMapping: async ({ index }: { index: string }) => ({
				body: {
					[index]: { mappings: { properties: { name: { type: 'keyword' }, study: { type: 'keyword' } } } },
				},
				statusCode: 200,
			}),
		},
		search,
	};

	return {
		esClient: wrapOpenSearchClient(openSearchClient as unknown as Parameters<typeof wrapOpenSearchClient>[0]),
		/** The searches an export paged with: each sorts on the `_id` tiebreaker, which no GraphQL read adds. */
		exportSearches: () =>
			searches.filter(({ body }) =>
				((body?.sort ?? []) as (Record<string, unknown> | string)[]).some((entry) =>
					typeof entry === 'string' ? entry === '_id' : Object.hasOwn(entry, '_id'),
				),
			),
		searches,
	};
};

type SearchEngine = ReturnType<typeof createSearchEngine>;

/**
 * Builds the router. With no filter given, exactly as a no-access-control deployment does: the
 * `getServerSideFilter` key is left out altogether rather than passed as undefined.
 */
const buildRouter = (searchEngine: SearchEngine, getServerSideFilter?: GetServerSideFilterFn<unknown>) =>
	arrangerRouter({
		configs: { documentType: DOCUMENT_TYPE, esIndex: CONFIGURED_INDEX },
		esClient: searchEngine.esClient,
		...(getServerSideFilter ? { getServerSideFilter } : {}),
	});

/**
 * The params object the stock UI's TSV exporter serializes into its form's `params` field: an empty
 * top-level name, and one file carrying the table's whole column objects, the catalogue's document
 * type and the base exporter's `maxRows` of 0, which means "the server's limit". A `sqon` override of
 * undefined leaves the key out once serialized.
 */
const stockDownloadParams = (fileOverrides: Record<string, unknown> = {}) => ({
	fileName: '',
	files: [
		{
			columns: STOCK_COLUMNS,
			documentType: DOCUMENT_TYPE,
			fileName: 'models.tsv',
			fileType: 'tsv',
			maxRows: 0,
			sqon: null,
			...fileOverrides,
		},
	],
});

/** Posts the stock UI's download form: `params` as JSON text, beside the other fields it always sends. */
const postStockDownload = (application: express.Express, path: string, params: Record<string, unknown>) =>
	request(application)
		.post(path)
		.type('form')
		.send({ downloadKey: 'a-download-key', httpHeaders: '{}', params: JSON.stringify(params) });

/** Pattern A: the router mounted the way the search server mounts it, after its own parsers and context. */
const buildPatternAApplication = async ({
	getServerSideFilter,
	mountPath = '/',
}: { getServerSideFilter?: GetServerSideFilterFn<unknown>; mountPath?: string } = {}) => {
	const searchEngine = createSearchEngine(STORED_DOCUMENTS);
	const application = express();

	application.use(json());
	application.use(urlencoded({ extended: false }));
	application.use(utils.addContext({ enableDebug: false }));
	application.use(mountPath, await buildRouter(searchEngine, getServerSideFilter));

	return { application, searchEngine };
};

/** Answers an export route's failure with its message, so a failing test shows why the export failed. */
const reportFailure = (response: Response, error: unknown) =>
	response.status(500).json({ error: error instanceof Error ? error.message : String(error) });

/**
 * Pattern B: the router at the root with an injected client, then the application's own export
 * routes, each passing `req.context` whole and nothing else that concerns access control. The client
 * posts only `{ files: [{ index, sqon, columns }] }`.
 */
const buildPatternBApplication = async ({
	getServerSideFilter,
	setFieldBeforeRouter = false,
}: { getServerSideFilter?: GetServerSideFilterFn<unknown>; setFieldBeforeRouter?: boolean } = {}) => {
	const searchEngine = createSearchEngine(STORED_DOCUMENTS);
	const application = express();

	application.use(json());

	if (setFieldBeforeRouter) {
		application.use((incoming, _response, next) => {
			(incoming as RequestWithContext).context = { tenant: APPLICATION_FIELD_VALUE };
			next();
		});
	}

	application.use(await buildRouter(searchEngine, getServerSideFilter));

	application.post('/context', (incoming, response) => {
		const { configs, esClient, tenant } = (incoming as RequestWithContext).context ?? {};

		response.json({
			configsIsObject: typeof configs === 'object' && configs !== null,
			hasEsClient: esClient !== undefined,
			tenant,
		});
	});

	application.post('/export/hits', async (incoming, response) => {
		try {
			const stream = await utils.getAllData({
				ctx: (incoming as RequestWithContext).context,
				maxRows: 10,
				sqon: incoming.body.files[0].sqon,
			});
			const chunks: unknown[] = [];

			for await (const chunk of stream) {
				chunks.push(chunk);
			}

			response.json({ chunks });
		} catch (error) {
			reportFailure(response, error);
		}
	});

	application.post('/export/tsv', async (incoming, response) => {
		try {
			const { contentType, output, responseFileName } = await dataStream({
				ctx: (incoming as RequestWithContext).context,
				params: incoming.body,
			});
			const chunks: unknown[] = [];

			for await (const chunk of output) {
				chunks.push(chunk);
			}

			response.json({ chunks, contentType, responseFileName });
		} catch (error) {
			reportFailure(response, error);
		}
	});

	return { application, searchEngine };
};

/** A Pattern B client's whole payload. A `sqon` of undefined leaves the key out once serialized. */
const patternBClientPayload = ({ sqon = null }: { sqon?: unknown } = {}) => ({
	files: [{ columns: STOCK_COLUMNS, index: CLIENT_NAMED_INDEX, sqon }],
});

/** Every row a Pattern B getAllData route received, across its chunks, failing on a non-200. */
const hitsFrom = (response: request.Response): unknown[] => {
	assert.equal(response.status, 200, `expected a 200, got ${response.status}: ${JSON.stringify(response.body)}`);

	return (response.body.chunks as ExportChunk[]).flatMap((chunk) => chunk.hits);
};

/** Every chunk a Pattern B dataStream route read from `output`, failing on a non-200. */
const tsvChunksFrom = (response: request.Response): unknown[] => {
	assert.equal(response.status, 200, `expected a 200, got ${response.status}: ${JSON.stringify(response.body)}`);

	return response.body.chunks as unknown[];
};

/** The body of a Pattern A download, failing on a non-200. */
const downloadedText = (response: request.Response): string => {
	assert.equal(response.status, 200, `expected a 200, got ${response.status}: ${response.text}`);

	return response.text;
};

/**
 * The file name an attachment's Content-Disposition header gives, whichever encoding carries it: the
 * extended `filename*` parameter when present, otherwise `filename`, quoted or not. Undefined when
 * the disposition is not an attachment.
 */
const attachmentFileName = (contentDisposition: string | undefined) => {
	if (!/^attachment\s*(;|$)/i.test(contentDisposition ?? '')) {
		return undefined;
	}

	const extendedName = contentDisposition?.match(/;\s*filename\*=UTF-8''([^;]*)/i)?.[1];

	return extendedName === undefined
		? contentDisposition?.match(/;\s*filename="?([^";]*)"?/i)?.[1]
		: decodeURIComponent(extendedName);
};

/** Fails the suite if the process sees an uncaught exception or unhandled rejection while it runs. */
const requireNoProcessErrors = () => {
	const faults: unknown[] = [];
	const recordFault = (fault: unknown) => faults.push(fault);

	before(() => {
		process.on('uncaughtException', recordFault);
		process.on('unhandledRejection', recordFault);
	});

	after(() => {
		process.off('uncaughtException', recordFault);
		process.off('unhandledRejection', recordFault);
		assert.deepEqual(faults, [], 'no uncaught exception or unhandled rejection while serving these exports');
	});
};

suite(
	'no-auth integration pattern A: the router serves its own download with no filter configured',
	{ timeout: 20000 },
	() => {
		requireNoProcessErrors();

		test('serves every document as a TSV attachment, header first, one newline-terminated row per document', async () => {
			// Given a router built with nothing about access control, over three stored documents
			const { application } = await buildPatternAApplication();

			// When the stock UI's download form is posted, with the base exporter's maxRows of 0
			const response = await postStockDownload(application, '/download', stockDownloadParams());

			// Then every document comes back, in _id order, as today's TSV
			assert.equal(downloadedText(response), EVERY_ROW_TSV_CHUNKS.join(''));
			assert.match(response.headers['content-type'] ?? '', /^text\/plain/);
			assert.equal(attachmentFileName(response.headers['content-disposition']), 'models.tsv');
		});

		test('serves the same rows when the router is mounted under a catalogue path', async () => {
			// Given the same router mounted at a catalogue path, as the multi-catalogue server mounts each one
			const { application } = await buildPatternAApplication({ mountPath: '/model-catalogue' });

			// When the stock UI's download form is posted to that catalogue's download path
			const response = await postStockDownload(application, '/model-catalogue/download', stockDownloadParams());

			// Then every document comes back exactly as at the root
			assert.equal(downloadedText(response), EVERY_ROW_TSV_CHUNKS.join(''));
		});

		test('keeps every row, once and in order, when the export spans several search pages', async () => {
			// Given the root-mounted router, and a file asking for one document per page
			const { application, searchEngine } = await buildPatternAApplication();

			// When the stock UI's download form is posted
			const response = await postStockDownload(application, '/download', stockDownloadParams({ chunkSize: 1 }));

			// Then the export took more than one page, and no row is missing or repeated
			assert.equal(downloadedText(response), EVERY_ROW_TSV_CHUNKS.join(''));
			assert.ok(
				searchEngine.exportSearches().length >= STORED_DOCUMENTS.length,
				`expected at least ${STORED_DOCUMENTS.length} page requests, got ${searchEngine.exportSearches().length}`,
			);
		});

		test("still narrows the export by the stock UI's own sqon", async () => {
			// Given the root-mounted router
			const { application } = await buildPatternAApplication();

			// When the stock UI posts a download naming two of the three documents
			const response = await postStockDownload(
				application,
				'/download',
				stockDownloadParams({ sqon: NAMED_MODELS_SQON }),
			);

			// Then exactly those two documents come back
			assert.equal(downloadedText(response), NAMED_MODELS_TSV_CHUNKS.join(''));
		});

		test('serves every row when the sqon is absent, an empty object or an empty combination, exactly as for null', async () => {
			// Given the root-mounted router
			const { application } = await buildPatternAApplication();

			// When the stock UI's form is posted once for each sqon that restricts nothing
			const outcomes = [];
			for (const [description, sqon] of UNRESTRICTING_SQONS) {
				const response = await postStockDownload(application, '/download', stockDownloadParams({ sqon }));
				outcomes.push({ description, status: response.status, text: response.text });
			}

			// Then each one serves every row
			assert.deepEqual(
				outcomes,
				UNRESTRICTING_SQONS.map(([description]) => ({
					description,
					status: 200,
					text: EVERY_ROW_TSV_CHUNKS.join(''),
				})),
			);
		});

		test('answers a sqon matching nothing with an empty 200, no header row, as today', async () => {
			// Given the root-mounted router
			const { application } = await buildPatternAApplication();

			// When the stock UI posts a download whose sqon names no stored document
			const response = await postStockDownload(
				application,
				'/download',
				stockDownloadParams({ sqon: NO_MATCH_SQON }),
			);

			// Then the download succeeds with nothing in it, not even the header
			assert.equal(downloadedText(response), '');
			assert.match(response.headers['content-type'] ?? '', /^text\/plain/);
		});
	},
);

suite(
	'no-auth integration pattern B: an application export route after the router, given req.context whole',
	{ timeout: 20000 },
	() => {
		requireNoProcessErrors();

		test('getAllData yields every document as { hits, total } chunks when nothing is passed anywhere', async () => {
			// Given an application whose route calls getAllData({ sqon, maxRows, ctx: req.context })
			const { application } = await buildPatternBApplication();

			// When the client posts its export payload with no sqon
			const response = await request(application).post('/export/hits').send(patternBClientPayload());

			// Then the route received chunks shaped { hits, total } that hold every document, in _id order
			assert.deepEqual(hitsFrom(response), SOURCES_IN_ID_ORDER);
			const chunks = response.body.chunks as ExportChunk[];
			for (const chunk of chunks) {
				assert.deepEqual(Object.keys(chunk).sort(), ['hits', 'total']);
				assert.ok(Array.isArray(chunk.hits), 'every chunk carries its rows as an array under hits');
				assert.equal(chunk.total, STORED_DOCUMENTS.length);
			}
		});

		test('getAllData narrows by the sqon the application takes from the client payload', async () => {
			// Given the same application
			const { application } = await buildPatternBApplication();

			// When the client names two of the three documents
			const response = await request(application)
				.post('/export/hits')
				.send(patternBClientPayload({ sqon: NAMED_MODELS_SQON }));

			// Then exactly those two documents arrive
			assert.deepEqual(hitsFrom(response), [{ name: 'Model One', study: 'STUDY-A' }, { name: 'Model Two' }]);
		});

		test('dataStream given the whole client object yields the header row, then one newline-terminated TSV row per document', async () => {
			// Given an application whose route calls dataStream({ params: <the whole client object>, ctx: req.context })
			const { application } = await buildPatternBApplication();

			// When the client posts its export payload with no sqon
			const response = await request(application).post('/export/tsv').send(patternBClientPayload());

			// Then the output is one string per row, header first, each splitting on tab into the requested columns
			const chunks = tsvChunksFrom(response);
			assert.deepEqual(chunks, EVERY_ROW_TSV_CHUNKS);
			assert.deepEqual(
				(chunks as string[]).map((row) => row.replace(/\n$/, '').split('\t')),
				[
					['Name', 'Study'],
					['Model One', 'STUDY-A'],
					['Model Two', '--'],
					['Model Three', 'STUDY-A'],
				],
			);
		});

		test('dataStream reports a plain-text file named for its type when the client names none', async () => {
			// Given the same application
			const { application } = await buildPatternBApplication();

			// When the client posts its export payload, which carries no fileName or fileType
			const response = await request(application).post('/export/tsv').send(patternBClientPayload());

			// Then the route can set its headers from a text/plain content type and a file.tsv name
			assert.equal(
				response.status,
				200,
				`expected a 200, got ${response.status}: ${JSON.stringify(response.body)}`,
			);
			assert.equal(response.body.contentType, 'text/plain');
			assert.equal(response.body.responseFileName, 'file.tsv');
		});

		test('dataStream narrows by the sqon in the client object', async () => {
			// Given the same application
			const { application } = await buildPatternBApplication();

			// When the client names two of the three documents
			const response = await request(application)
				.post('/export/tsv')
				.send(patternBClientPayload({ sqon: NAMED_MODELS_SQON }));

			// Then exactly those two rows follow the header
			assert.deepEqual(tsvChunksFrom(response), NAMED_MODELS_TSV_CHUNKS);
		});

		test("dataStream searches only the router's configured index, never the one the client payload names", async () => {
			// Given the same application, whose client payload names an index of its own
			const { application, searchEngine } = await buildPatternBApplication();
			assert.notEqual(CLIENT_NAMED_INDEX, CONFIGURED_INDEX);

			// When the client posts that payload
			const response = await request(application).post('/export/tsv').send(patternBClientPayload());

			// Then every row arrives, and every search the export made went to the configured index
			assert.deepEqual(tsvChunksFrom(response), EVERY_ROW_TSV_CHUNKS);
			assert.ok(searchEngine.exportSearches().length > 0, 'expected at least one export search');
			assert.deepEqual([...new Set(searchEngine.searches.map(({ index }) => index))], [CONFIGURED_INDEX]);
		});

		test('getAllData and dataStream export every document when the sqon is absent, an empty object or an empty combination', async () => {
			// Given the same application
			const { application } = await buildPatternBApplication();

			// When the client posts once to each route for each sqon that restricts nothing
			const outcomes = [];
			for (const [description, sqon] of UNRESTRICTING_SQONS) {
				const hitsResponse = await request(application)
					.post('/export/hits')
					.send(patternBClientPayload({ sqon }));
				const tsvResponse = await request(application)
					.post('/export/tsv')
					.send(patternBClientPayload({ sqon }));
				outcomes.push({
					description,
					hits: hitsResponse.status === 200 ? hitsFrom(hitsResponse) : hitsResponse.body,
					tsv: tsvResponse.status === 200 ? tsvChunksFrom(tsvResponse) : tsvResponse.body,
				});
			}

			// Then each one exports every document, exactly as with no sqon
			assert.deepEqual(
				outcomes,
				UNRESTRICTING_SQONS.map(([description]) => ({
					description,
					hits: SOURCES_IN_ID_ORDER,
					tsv: EVERY_ROW_TSV_CHUNKS,
				})),
			);
		});

		test('getAllData yields no chunk, and dataStream nothing at all, not even a header, when the sqon matches nothing', async () => {
			// Given the same application
			const { application } = await buildPatternBApplication();

			// When the client names no stored document, to each route
			const hitsResponse = await request(application)
				.post('/export/hits')
				.send(patternBClientPayload({ sqon: NO_MATCH_SQON }));
			const tsvResponse = await request(application)
				.post('/export/tsv')
				.send(patternBClientPayload({ sqon: NO_MATCH_SQON }));

			// Then both exports succeed empty, as today
			assert.equal(
				hitsResponse.status,
				200,
				`expected a 200, got ${hitsResponse.status}: ${JSON.stringify(hitsResponse.body)}`,
			);
			assert.deepEqual(hitsResponse.body.chunks, []);
			assert.deepEqual(tsvChunksFrom(tsvResponse), []);
		});
	},
);

suite(
	'no-auth integration pattern B: a field the application sets on req.context before the router',
	{ timeout: 20000 },
	() => {
		requireNoProcessErrors();

		test("survives beside the router's own context for routes mounted after it", async () => {
			// Given an application that sets req.context.tenant before mounting the router
			const { application } = await buildPatternBApplication({ setFieldBeforeRouter: true });

			// When a route mounted after the router reads req.context
			const response = await request(application).post('/context').send(patternBClientPayload());

			// Then the application's field is still there, beside the router's configs and search client
			assert.equal(response.status, 200);
			assert.deepEqual(response.body, {
				configsIsObject: true,
				hasEsClient: true,
				tenant: APPLICATION_FIELD_VALUE,
			});
		});

		test('does not stop getAllData exporting every document', async () => {
			// Given the application that sets req.context.tenant before the router
			const { application } = await buildPatternBApplication({ setFieldBeforeRouter: true });

			// When the client posts its export payload to the getAllData route
			const response = await request(application).post('/export/hits').send(patternBClientPayload());

			// Then every document still arrives
			assert.deepEqual(hitsFrom(response), SOURCES_IN_ID_ORDER);
		});

		test('does not stop dataStream exporting every row', async () => {
			// Given the application that sets req.context.tenant before the router
			const { application } = await buildPatternBApplication({ setFieldBeforeRouter: true });

			// When the client posts its export payload to the dataStream route
			const response = await request(application).post('/export/tsv').send(patternBClientPayload());

			// Then every row still arrives, header first
			assert.deepEqual(tsvChunksFrom(response), EVERY_ROW_TSV_CHUNKS);
		});
	},
);

suite('the same integration wiring with a restricting filter configured on the router', { timeout: 20000 }, () => {
	requireNoProcessErrors();

	test("pattern A's download serves only the documents the router's filter permits", async () => {
		// Given the Pattern A application, its router built with a filter permitting study A only
		const { application } = await buildPatternAApplication({ getServerSideFilter: STUDY_A_FILTER });

		// When the stock UI's download form is posted, asking for every document
		const response = await postStockDownload(application, '/download', stockDownloadParams());

		// Then only the study-A documents come back
		assert.equal(downloadedText(response), STUDY_A_TSV_CHUNKS.join(''));
	});

	test("pattern B's getAllData route, passing nothing but req.context, exports only what the router's filter permits", async () => {
		// Given the Pattern B application, its router built with the same filter and its route unchanged
		const { application } = await buildPatternBApplication({ getServerSideFilter: STUDY_A_FILTER });

		// When the client posts its export payload with no sqon
		const response = await request(application).post('/export/hits').send(patternBClientPayload());

		// Then only the study-A documents arrive
		assert.deepEqual(hitsFrom(response), [
			{ name: 'Model One', study: 'STUDY-A' },
			{ name: 'Model Three', study: 'STUDY-A' },
		]);
	});

	test("pattern B's dataStream route exports only what the router's filter permits, and the client's sqon narrows within it", async () => {
		// Given the Pattern B application, its router built with the same filter
		const { application } = await buildPatternBApplication({ getServerSideFilter: STUDY_A_FILTER });

		// When the client posts its payload once with no sqon, and once naming Model One and Model Two
		const unnarrowed = await request(application).post('/export/tsv').send(patternBClientPayload());
		const narrowed = await request(application)
			.post('/export/tsv')
			.send(patternBClientPayload({ sqon: NAMED_MODELS_SQON }));

		// Then the first holds the study-A rows, and the second only the one row both permit
		assert.deepEqual(tsvChunksFrom(unnarrowed), STUDY_A_TSV_CHUNKS);
		assert.deepEqual(tsvChunksFrom(narrowed), ['Name\tStudy\n', 'Model One\tSTUDY-A\n']);
	});
});
