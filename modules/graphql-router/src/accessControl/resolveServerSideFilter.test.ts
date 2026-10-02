import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { mock, suite, test } from 'node:test';
import { format } from 'node:util';

import express, { type Request } from 'express';
import request from 'supertest';

import { dataStream } from '#download/index.js';
import * as packageRoot from '#index.js';
import arrangerRouter from '#router.js';
import type { SearchClient } from '#searchClient/index.js';
import getAllData from '#utils/getAllData.js';

import { restrictingFilter } from './serverSideFilters.fixture.js';

/*
 * The resolution table for export entry points (getAllData, dataStream, and the router's own
 * /download), exercised through those entry points rather than through any one helper:
 *
 *   record present, caller passes nothing    -> the record's filter
 *   record present, caller passes a function -> the record's filter AND the caller's
 *   record absent,  caller passes nothing    -> refused
 *   record absent,  caller passes a function -> the caller's filter
 *
 * The filters are chosen so every outcome yields different rows: the router's permits study A
 * (DO_01, DO_03, DO_05), the caller's permits DO_01 and DO_02, their intersection is DO_01 alone,
 * and their union would be four documents.
 */

type StoredDocument = { _id: string; _source: Record<string, string> };
type SearchQuery = Record<string, any>;
type SearchParameters = { body?: { query?: SearchQuery; search_after?: string[] }; from?: number; size?: number };
type RequestContext = Record<string | symbol, unknown>;
type ExportArguments = Record<string, unknown> & { ctx: unknown };

const CATALOGUE_CONFIGS = { documentType: 'donor', esIndex: 'donor_index' };
const MAPPING = { donor_id: { type: 'keyword' }, study: { type: 'keyword' } };
const SECRET_DETAIL = 'token service unreachable at 10.0.0.5';
const TIME_LIMIT_MS = 5000;

const DOCUMENTS: StoredDocument[] = ['A', 'B', 'A', 'B', 'A'].map((study, index) => ({
	_id: `DO_0${index + 1}`,
	_source: { donor_id: `DO_0${index + 1}`, study },
}));
const ALL_IDS = DOCUMENTS.map(({ _id }) => _id);
const STUDY_A_IDS = ['DO_01', 'DO_03', 'DO_05'];

const STUDY_A = restrictingFilter({ fieldName: 'study', values: ['A'] });
const FIRST_TWO = restrictingFilter({ fieldName: 'donor_id', values: ['DO_01', 'DO_02'] });
const FIRST_THREE = restrictingFilter({ fieldName: 'donor_id', values: ['DO_01', 'DO_02', 'DO_03'] });

const COLUMNS = [
	{ accessor: 'donor_id', displayName: 'Donor', fieldName: 'donor_id' },
	{ accessor: 'study', displayName: 'Study', fieldName: 'study' },
];

/** Download params asking for one TSV file of every document, optionally paged `chunkSize` rows at a time. */
const tsvParameters = ({ chunkSize }: { chunkSize?: number } = {}) => ({
	files: [
		{ ...(chunkSize ? { chunkSize } : {}), columns: COLUMNS, fileName: 'donors.tsv', fileType: 'tsv', sqon: null },
	],
});

/** Values that are neither undefined nor a function, and the type a refusal of each should name. */
const UNUSABLE_CALLER_VALUES: [string, unknown, RegExp][] = [
	['null', null, /\bnull\b/],
	['false', false, /\bboolean\b/],
	['zero', 0, /\bnumber\b/],
	['an empty string', '', /\bstring\b/],
	['a string', 'includeEverything', /\bstring\b/],
	['a plain object', {}, /\bobject\b/],
	['a SQON object', { content: { fieldName: 'study', value: ['A'] }, op: 'in' }, /\bobject\b/],
	['a symbol', Symbol('includeEverything'), /\bsymbol\b/],
];

const valuesOf = (document: StoredDocument, fieldName: string): unknown[] =>
	fieldName === '_id' ? [document._id] : [document._source[fieldName]].filter((value) => value !== undefined);

const asList = (clauses: unknown): SearchQuery[] => (clauses === undefined ? [] : ([clauses].flat() as SearchQuery[]));

/**
 * Evaluates the part of the query DSL a compiled SQON uses, so a test can assert which rows an
 * export yields rather than what its query looks like. Anything else throws, so an unfamiliar
 * clause fails the test instead of matching silently.
 */
const matchesQuery = (document: StoredDocument, query: SearchQuery | undefined): boolean => {
	if (query === undefined || Object.keys(query).length === 0 || 'match_all' in query) {
		return true;
	}

	if ('terms' in query) {
		const termsEntry = Object.entries(query.terms as Record<string, unknown[]>).find(([key]) => key !== 'boost');
		assert.ok(termsEntry, `The stub search engine found no field in ${JSON.stringify(query)}`);
		const [fieldName, values] = termsEntry;
		return valuesOf(document, fieldName).some((value) => values.includes(value));
	}

	if ('bool' in query) {
		const { filter, minimum_should_match: minimumShouldMatch, must, must_not: mustNot, should } = query.bool;
		const required = [...asList(must), ...asList(filter)];
		const optional = asList(should);
		const optionalNeeded = minimumShouldMatch ?? (required.length === 0 && optional.length > 0 ? 1 : 0);

		return (
			required.every((clause) => matchesQuery(document, clause)) &&
			!asList(mustNot).some((clause) => matchesQuery(document, clause)) &&
			optional.filter((clause) => matchesQuery(document, clause)).length >= optionalNeeded
		);
	}

	throw new Error(`The stub search engine cannot evaluate ${JSON.stringify(query)}`);
};

/** A search engine over DOCUMENTS that evaluates each query and pages by size and search_after, recording every search. */
const createSearchEngine = () => {
	const searches: SearchParameters[] = [];
	const client = {
		cat: { aliases: async () => ({ body: [] }) },
		indices: {
			getMapping: async ({ index }: { index: string }) => ({
				body: { [index]: { mappings: { properties: MAPPING } } },
			}),
		},
		search: async (parameters: SearchParameters) => {
			searches.push(parameters);
			const matched = DOCUMENTS.filter((document) => matchesQuery(document, parameters.body?.query));
			const after = parameters.body?.search_after?.at(-1);
			const remaining = after === undefined ? matched : matched.filter(({ _id }) => _id > after);
			const from = parameters.from ?? 0;
			const page = remaining.slice(from, from + (parameters.size ?? 10));

			return {
				body: {
					_shards: { failed: 0, successful: 1, total: 1 },
					hits: {
						hits: page.map((document) => ({
							...document,
							_source: { ...document._source },
							sort: [document._id],
						})),
						total: { relation: 'eq', value: matched.length },
					},
					timed_out: false,
					took: 1,
				},
			};
		},
	} as unknown as SearchClient;

	return { client, searches };
};

const CONSOLE_METHODS = ['debug', 'error', 'info', 'log', 'warn'] as const;

/** Runs `work` with console output captured instead of printed, returning what it wrote. */
const withConsoleCaptured = async <Result>(
	work: () => Promise<Result>,
): Promise<{ lines: string[]; result: Result }> => {
	const lines: string[] = [];
	const mocks = CONSOLE_METHODS.map((method) =>
		mock.method(console, method, (...args: unknown[]) => {
			lines.push(format(...args));
		}),
	);

	try {
		return { lines, result: await work() };
	} finally {
		mocks.forEach((mocked) => mocked.mock.restore());
	}
};

const quietly = async <Result>(work: () => Promise<Result>): Promise<Result> =>
	(await withConsoleCaptured(work)).result;

/**
 * Builds a router over its own stub engine, mounts it at an app's root, and captures the context a
 * route after it sees: the context an application's own export route hands to getAllData. Leaving
 * `getServerSideFilter` out of `settings` passes nothing at all.
 */
const routerContext = async (settings: Record<string, unknown> = {}) => {
	const engine = createSearchEngine();
	const router = await quietly(() =>
		arrangerRouter({ configs: CATALOGUE_CONFIGS, esClient: engine.client, ...settings }),
	);
	const contexts: RequestContext[] = [];
	const app = express()
		.use(router)
		.get('/context', (req: Request, res) => {
			contexts.push((req as unknown as { context: RequestContext }).context);
			res.end();
		});

	await request(app).get('/context');

	return { app, context: contexts[0], engine };
};

/**
 * What an integrator assembles by hand from a router's parts: its configs, client and schema, but
 * no record, because no router built this object.
 */
const contextWithoutRecord = (context: RequestContext | undefined): RequestContext => ({
	configs: context?.configs,
	esClient: context?.esClient,
	schema: context?.schema,
});

/** Every chunk a stream yields, failing rather than hanging if it never ends. */
const collect = (stream: AsyncIterable<unknown>): Promise<unknown[]> =>
	Readable.from(stream).toArray({ signal: AbortSignal.timeout(TIME_LIMIT_MS) });

/**
 * The donor ids getAllData exports. One page holds every document unless the arguments ask for
 * smaller ones, so a resolution test depends on which filter applied and not on how paging works.
 */
const exportedIds = (exportArguments: ExportArguments): Promise<string[]> =>
	quietly(async () => {
		const chunks = (await collect(
			await getAllData({ chunkSize: DOCUMENTS.length, sqon: null, ...exportArguments }),
		)) as {
			hits: { donor_id: string }[];
		}[];
		return chunks.flatMap(({ hits }) => hits.map(({ donor_id: donorId }) => donorId));
	});

/** The first column of every row after the header in a TSV export. */
const idsFromTsv = (text: string): string[] =>
	text
		.split('\n')
		.filter(Boolean)
		.slice(1)
		.map((row) => row.split('\t')[0] ?? '');

/** The donor ids dataStream exports as TSV. */
const dataStreamIds = (exportArguments: ExportArguments): Promise<string[]> =>
	quietly(async () => {
		const { output } = await dataStream({ params: tsvParameters(), ...exportArguments } as never);
		return idsFromTsv((await collect(output)).join(''));
	});

const download = (app: express.Express, parameters: unknown) =>
	quietly(() =>
		request(app)
			.post('/download')
			.type('form')
			.send({ params: JSON.stringify(parameters) })
			.then((response) => response),
	);

/** The error an export call rejects with, failing the test if the call resolves instead. */
const refusalOf = async (attempt: () => Promise<unknown>): Promise<Error> => {
	const outcome = await quietly(() =>
		attempt().then(
			() => undefined,
			(error: unknown) => error,
		),
	);

	assert.ok(outcome instanceof Error, 'expected the call itself to be refused');
	return outcome;
};

/** Asserts the no-record refusal names the lower-risk fix first: the router's own filter, then includeEverything. */
const assertAdvisesTheRouterFilterFirst = (refusal: Error) => {
	const routerFilterAdvice = refusal.message.search(/router was configured with/i);
	const includeEverythingAdvice = refusal.message.search(/includeEverything/);

	assert.ok(routerFilterAdvice >= 0, `expected advice to pass the router's own filter, got: ${refusal.message}`);
	assert.ok(
		includeEverythingAdvice > routerFilterAdvice,
		`expected includeEverything to be advised after the router's filter, got: ${refusal.message}`,
	);
	assert.match(refusal.message, /no access control/i);
};

/** A callback recording each context it is called with, filtering as `filter` does. */
const countingCallback = (filter: (context: unknown) => unknown) => {
	const calls: unknown[] = [];

	return {
		callback: (context: unknown) => {
			calls.push(context);
			return filter(context);
		},
		calls,
	};
};

/** Records every uncaught exception and unhandled rejection until stopped. */
const recordProcessErrors = () => {
	const faults: unknown[] = [];
	const record = (fault: unknown) => {
		faults.push(fault);
	};
	process.on('uncaughtException', record);
	process.on('unhandledRejection', record);

	return {
		faults,
		stop: () => {
			process.off('uncaughtException', record);
			process.off('unhandledRejection', record);
		},
	};
};

/** Lets pending promise rejections surface as process events before a test looks for them. */
const afterPendingRejections = () => new Promise((resolve) => setTimeout(resolve, 20));

/**
 * The descriptions of the caller values a call accepted, or refused without naming the value's type.
 * Also reports a refusal message that stays the same across types, since one fixed list of every type
 * name would otherwise pass for naming each.
 */
const valuesNotRefusedByType = async (attempt: (callerValue: unknown) => Promise<unknown>): Promise<string[]> => {
	const outcomes = await Promise.all(
		UNUSABLE_CALLER_VALUES.map(async ([description, callerValue, typeName]) => {
			const outcome = await quietly(() =>
				Promise.resolve()
					.then(() => attempt(callerValue))
					.then(
						() => undefined,
						(error: unknown) => error,
					),
			);
			const message = outcome instanceof Error ? outcome.message : '';
			const namesType = typeName.test(message) && (callerValue !== null || !/\bobject\b/.test(message));

			return { description, message, namesType, typeName: typeName.source };
		}),
	);
	const messagesByType = new Map(outcomes.map(({ message, typeName }) => [typeName, message]));
	const typeIndependent =
		new Set(messagesByType.values()).size < messagesByType.size
			? ['one message for values of different types']
			: [];

	return [
		...outcomes.filter(({ namesType }) => !namesType).map(({ description }) => description),
		...typeIndependent,
	];
};

/** Contexts carrying no record that an integrator might plausibly pass: none at all, null, and an empty object. */
const DEGENERATE_CONTEXTS: [string, unknown][] = [
	['an absent context', undefined],
	['a null context', null],
	['an empty context', {}],
];

suite("getAllData resolves its filter from the router's record and the caller's argument", () => {
	test("applies the router's filter when the caller passes nothing", async () => {
		// Given the context a restricting router built
		const { context } = await routerContext({ getServerSideFilter: STUDY_A });

		// When getAllData is called with no filter of its own
		const ids = await exportedIds({ ctx: context });

		// Then the export holds exactly what the router permits
		assert.deepEqual(ids, STUDY_A_IDS);
	});

	test('treats an explicit undefined exactly as passing nothing', async () => {
		// Given the same context
		const { context } = await routerContext({ getServerSideFilter: STUDY_A });

		// When getAllData is given getServerSideFilter: undefined
		const ids = await exportedIds({ ctx: context, getServerSideFilter: undefined });

		// Then the router's filter still applies
		assert.deepEqual(ids, STUDY_A_IDS);
	});

	test("narrows the router's filter with the caller's, never replacing it", async () => {
		// Given the same context, and a caller filter permitting DO_01 and DO_02
		const { context } = await routerContext({ getServerSideFilter: STUDY_A });

		// When getAllData is given the caller's filter
		const ids = await exportedIds({ ctx: context, getServerSideFilter: FIRST_TWO });

		// Then only documents both permit remain
		assert.deepEqual(ids, ['DO_01']);
	});

	test("cannot widen the router's filter by passing includeEverything", async () => {
		// Given the same context
		const { context } = await routerContext({ getServerSideFilter: STUDY_A });
		assert.equal(typeof packageRoot.includeEverything, 'function');

		// When getAllData is given includeEverything
		const ids = await exportedIds({ ctx: context, getServerSideFilter: packageRoot.includeEverything });

		// Then the router's filter still applies
		assert.deepEqual(ids, STUDY_A_IDS);
	});

	test("keeps the router's filter on a shallow copy of the context", async () => {
		// Given a spread copy of the context, as an application adding its own fields makes
		const { context } = await routerContext({ getServerSideFilter: STUDY_A });
		const copy = { ...context, tenant: 'added by the application' };

		// When getAllData is called on the copy with nothing, and with the caller's filter
		const withNothing = await exportedIds({ ctx: copy });
		const withCallerFilter = await exportedIds({ ctx: copy, getServerSideFilter: FIRST_TWO });

		// Then the copy carries the router's filter exactly as the original does
		assert.deepEqual(withNothing, STUDY_A_IDS);
		assert.deepEqual(withCallerFilter, ['DO_01']);
	});

	test('exports every document when the router was given nothing and the caller passes nothing', async () => {
		// Given the context a router built with no filter
		const { context } = await routerContext();

		// When getAllData is called with no filter of its own
		const ids = await exportedIds({ ctx: context });

		// Then every document is exported
		assert.deepEqual(ids, ALL_IDS);
	});

	test("applies only the caller's filter when the router was given nothing", async () => {
		// Given the context a router built with no filter
		const { context } = await routerContext();

		// When getAllData is given the caller's filter
		const ids = await exportedIds({ ctx: context, getServerSideFilter: FIRST_TWO });

		// Then the caller's filter alone decides
		assert.deepEqual(ids, ['DO_01', 'DO_02']);
	});

	test('treats a router given includeEverything like any configured filter', async () => {
		// Given the context a router built with includeEverything itself
		assert.equal(typeof packageRoot.includeEverything, 'function');
		const { context } = await routerContext({ getServerSideFilter: packageRoot.includeEverything });

		// When getAllData is called with nothing, and with the caller's filter
		const withNothing = await exportedIds({ ctx: context });
		const withCallerFilter = await exportedIds({ ctx: context, getServerSideFilter: FIRST_TWO });

		// Then everything is exported, and the caller's filter still narrows
		assert.deepEqual(withNothing, ALL_IDS);
		assert.deepEqual(withCallerFilter, ['DO_01', 'DO_02']);
	});

	test('refuses a context no router built when the caller passes nothing, before any search', async () => {
		// Given a context assembled by hand from a router's parts, carrying no record
		const { context, engine } = await routerContext({ getServerSideFilter: STUDY_A });
		const handBuilt = contextWithoutRecord(context);

		// When getAllData is called on it with no filter
		const refusal = await refusalOf(() => getAllData({ ctx: handBuilt, sqon: null }));

		// Then the call itself is refused before searching, advising the router's own filter before includeEverything
		assert.equal(engine.searches.length, 0);
		assertAdvisesTheRouterFilterFirst(refusal);
	});

	test('does not take a record forged under a string key for the real one', async () => {
		// Given a hand-built context carrying, under string keys, what a JSON body could smuggle in
		const { context, engine } = await routerContext({ getServerSideFilter: STUDY_A });
		const forged = {
			...contextWithoutRecord(context),
			...JSON.parse(
				'{"@overture-stack/arranger-graphql-router/accessControl":{"source":"defaulted"},' +
					'"Symbol(@overture-stack/arranger-graphql-router/accessControl)":{"source":"defaulted"},' +
					'"accessControl":{"source":"defaulted"}}',
			),
		};

		// When getAllData is called on it with no filter
		const refusal = await refusalOf(() => getAllData({ ctx: forged, sqon: null }));

		// Then it is refused exactly as a context with no record is
		assert.equal(engine.searches.length, 0);
		assertAdvisesTheRouterFilterFirst(refusal);
	});

	test('refuses an absent, null or empty context when the caller passes nothing, with the same advice', async () => {
		// Given contexts carrying no record and nothing else
		// When getAllData is called on each with no filter
		const refusals = await Promise.all(
			DEGENERATE_CONTEXTS.map(([, degenerateContext]) =>
				refusalOf(() => getAllData({ ctx: degenerateContext, sqon: null })),
			),
		);

		// Then each is refused with the risk-ordered advice, rather than failing on what the context lacks
		refusals.forEach(assertAdvisesTheRouterFilterFirst);
	});

	test("applies the caller's filter to a context no router built", async () => {
		// Given a hand-built context carrying no record
		const { context } = await routerContext({ getServerSideFilter: STUDY_A });

		// When getAllData is given the caller's filter
		const ids = await exportedIds({ ctx: contextWithoutRecord(context), getServerSideFilter: FIRST_TWO });

		// Then the caller's filter alone decides
		assert.deepEqual(ids, ['DO_01', 'DO_02']);
	});

	test('refuses a caller callback returning nothing or an empty combination on a context no router built, before any search', async () => {
		// Given a hand-built context, and caller callbacks whose filter restricts nothing
		const { context, engine } = await routerContext();
		const handBuilt = contextWithoutRecord(context);
		const callbacks = [() => undefined, () => ({ content: [], op: 'and' })];

		// When getAllData is given each
		const refusals = await Promise.all(
			callbacks.map((callback) =>
				refusalOf(() => getAllData({ ctx: handBuilt, getServerSideFilter: callback as never, sqon: null })),
			),
		);

		// Then each is refused as an access-control failure, as the router's own filter would be, and nothing is searched
		refusals.forEach((refusal) => assert.equal(refusal.name, 'AccessControlError', refusal.message));
		assert.equal(engine.searches.length, 0);
	});

	test('exports every document on a context no router built when the caller passes includeEverything', async () => {
		// Given a hand-built context carrying no record
		const { context } = await routerContext({ getServerSideFilter: STUDY_A });
		assert.equal(typeof packageRoot.includeEverything, 'function');

		// When getAllData is given includeEverything
		const ids = await exportedIds({
			ctx: contextWithoutRecord(context),
			getServerSideFilter: packageRoot.includeEverything,
		});

		// Then every document is exported
		assert.deepEqual(ids, ALL_IDS);
	});

	test('refuses a caller value that is neither undefined nor a function, naming its type, whatever the context', async () => {
		// Given a restricting router's context, a defaulted router's, and one no router built
		const restricting = await routerContext({ getServerSideFilter: STUDY_A });
		const defaulted = await routerContext();
		const contexts = {
			'a defaulted router': defaulted.context,
			'a restricting router': restricting.context,
			'no router': contextWithoutRecord(restricting.context),
		};

		// When getAllData is given each unusable value on each context
		const notRefused = await Promise.all(
			Object.entries(contexts).map(async ([contextDescription, context]) =>
				(
					await valuesNotRefusedByType((callerValue) =>
						getAllData({ ctx: context, getServerSideFilter: callerValue as never, sqon: null }),
					)
				).map((valueDescription) => `${valueDescription} on ${contextDescription}`),
			),
		);

		// Then every call is refused naming the value's type, null as null, and nothing is searched
		assert.deepEqual(notRefused.flat(), []);
		assert.equal(restricting.engine.searches.length + defaulted.engine.searches.length, 0);
	});
});

suite('dataStream resolves its filter the same way', () => {
	test("applies the router's filter when the caller passes nothing", async () => {
		// Given the context a restricting router built
		const { context } = await routerContext({ getServerSideFilter: STUDY_A });

		// When dataStream exports a TSV with no filter of its own
		const ids = await dataStreamIds({ ctx: context });

		// Then the rows are exactly what the router permits
		assert.deepEqual(ids, STUDY_A_IDS);
	});

	test("narrows the router's filter with the caller's", async () => {
		// Given the same context
		const { context } = await routerContext({ getServerSideFilter: STUDY_A });

		// When dataStream is given the caller's filter
		const ids = await dataStreamIds({ ctx: context, getServerSideFilter: FIRST_TWO });

		// Then only documents both permit remain
		assert.deepEqual(ids, ['DO_01']);
	});

	test('exports every document when the router was given nothing and the caller passes nothing', async () => {
		// Given the context a router built with no filter
		const { context } = await routerContext();

		// When dataStream exports with no filter of its own
		const ids = await dataStreamIds({ ctx: context });

		// Then every document is exported
		assert.deepEqual(ids, ALL_IDS);
	});

	test('refuses a context no router built when the caller passes nothing, before any output', async () => {
		// Given a hand-built context carrying no record
		const { context, engine } = await routerContext({ getServerSideFilter: STUDY_A });

		// When dataStream is called on it with no filter
		const refusal = await refusalOf(() =>
			dataStream({ ctx: contextWithoutRecord(context), params: tsvParameters() } as never),
		);

		// Then the call itself is refused before searching, with the same risk-ordered advice
		assert.equal(engine.searches.length, 0);
		assertAdvisesTheRouterFilterFirst(refusal);
	});

	test("applies the caller's filter to a context no router built", async () => {
		// Given a hand-built context carrying no record
		const { context } = await routerContext({ getServerSideFilter: STUDY_A });

		// When dataStream is given the caller's filter
		const ids = await dataStreamIds({ ctx: contextWithoutRecord(context), getServerSideFilter: FIRST_TWO });

		// Then the caller's filter alone decides
		assert.deepEqual(ids, ['DO_01', 'DO_02']);
	});

	test('refuses a caller value that is neither undefined nor a function, naming its type', async () => {
		// Given a restricting router's context, and one no router built
		const restricting = await routerContext({ getServerSideFilter: STUDY_A });
		const contexts = {
			'a restricting router': restricting.context,
			'no router': contextWithoutRecord(restricting.context),
		};

		// When dataStream is given each unusable value on each context
		const notRefused = await Promise.all(
			Object.entries(contexts).map(async ([contextDescription, context]) =>
				(
					await valuesNotRefusedByType((callerValue) =>
						dataStream({
							ctx: context,
							getServerSideFilter: callerValue,
							params: tsvParameters(),
						} as never),
					)
				).map((valueDescription) => `${valueDescription} on ${contextDescription}`),
			),
		);

		// Then every call is refused naming the value's type, and nothing is searched
		assert.deepEqual(notRefused.flat(), []);
		assert.equal(restricting.engine.searches.length, 0);
	});
});

suite("the router's /download resolves its filter from its own record", () => {
	test("exports only what the router's filter permits", async () => {
		// Given an app serving a restricting router
		const { app } = await routerContext({ getServerSideFilter: STUDY_A });

		// When one TSV file is downloaded
		const response = await download(app, tsvParameters());

		// Then the rows are exactly what the router permits
		assert.equal(response.status, 200);
		assert.deepEqual(idsFromTsv(response.text), STUDY_A_IDS);
	});

	test('exports every document when the router was given nothing', async () => {
		// Given an app serving a router built with no filter
		const { app } = await routerContext();

		// When one TSV file is downloaded
		const response = await download(app, tsvParameters());

		// Then every document is exported
		assert.equal(response.status, 200);
		assert.deepEqual(idsFromTsv(response.text), ALL_IDS);
	});

	test("evaluates the router's callback against the request's context, including what the application set before the router", async () => {
		// Given an app that sets a field on the context before a router whose callback permits the study that field names
		const engine = createSearchEngine();
		const routerCallback = countingCallback((callbackContext: unknown) =>
			restrictingFilter({
				fieldName: 'study',
				values: [String((callbackContext as RequestContext | undefined)?.permittedStudy)],
			})(callbackContext),
		);
		const router = await quietly(() =>
			arrangerRouter({
				configs: CATALOGUE_CONFIGS,
				esClient: engine.client,
				getServerSideFilter: routerCallback.callback as never,
			}),
		);
		const app = express()
			.use((req, _res, next) => {
				(req as unknown as { context: RequestContext }).context = { permittedStudy: 'B' };
				next();
			})
			.use(router);

		// When one TSV file is downloaded
		const response = await download(app, tsvParameters());

		// Then the callback saw that request's context, and the rows are the study it named
		assert.equal(response.status, 200);
		assert.equal(routerCallback.calls.length, 1);
		assert.deepEqual(idsFromTsv(response.text), ['DO_02', 'DO_04']);
	});
});

suite('evaluating a filter callback for an export', () => {
	test('turns a throwing router callback into an AccessControlError carrying what it threw, before any search', async () => {
		// Given a router whose callback throws
		const thrown = new Error(SECRET_DETAIL);
		const { context, engine } = await routerContext({
			getServerSideFilter: () => {
				throw thrown;
			},
		});

		// When getAllData is called on its context
		const refusal = await refusalOf(() => getAllData({ ctx: context, sqon: null }));

		// Then the call is refused with an AccessControlError whose cause is the original, and nothing is searched
		assert.equal(refusal.name, 'AccessControlError');
		assert.equal(refusal.cause, thrown);
		assert.equal(engine.searches.length, 0);
	});

	test('turns a throwing caller callback into an AccessControlError carrying what it threw', async () => {
		// Given a hand-built context and a caller callback that throws
		const { context, engine } = await routerContext();
		const thrown = new Error(SECRET_DETAIL);

		// When getAllData is given that callback
		const refusal = await refusalOf(() =>
			getAllData({
				ctx: contextWithoutRecord(context),
				getServerSideFilter: () => {
					throw thrown;
				},
				sqon: null,
			}),
		);

		// Then the call is refused with an AccessControlError whose cause is the original
		assert.equal(refusal.name, 'AccessControlError');
		assert.equal(refusal.cause, thrown);
		assert.equal(engine.searches.length, 0);
	});

	test('refuses a caller callback that returns a promise, even of a valid filter', async () => {
		// Given a hand-built context and an async caller callback
		const { context, engine } = await routerContext();

		// When getAllData is given that callback
		const refusal = await refusalOf(() =>
			getAllData({
				ctx: contextWithoutRecord(context),
				getServerSideFilter: (async (callbackContext: unknown) => FIRST_TWO(callbackContext)) as never,
				sqon: null,
			}),
		);

		// Then the promise is refused rather than read as a filter
		assert.equal(refusal.name, 'AccessControlError');
		assert.equal(engine.searches.length, 0);
	});

	test('refuses a returned promise or other thenable, carrying the value returned as its cause', async () => {
		// Given a hand-built context, and caller callbacks returning a promise and a thenable that is not a promise
		const { context, engine } = await routerContext();
		const returnedValues = [
			Promise.resolve(FIRST_TWO({})),
			{ then: (resolve: (filter: unknown) => void) => resolve(FIRST_TWO({})) },
		];

		// When getAllData is given each
		const refusals = await Promise.all(
			returnedValues.map((returned) =>
				refusalOf(() =>
					getAllData({
						ctx: contextWithoutRecord(context),
						getServerSideFilter: (() => returned) as never,
						sqon: null,
					}),
				),
			),
		);

		// Then each is refused as an access-control failure whose cause is the very value the callback returned
		refusals.forEach((refusal, index) => {
			assert.equal(refusal.name, 'AccessControlError');
			assert.equal(refusal.cause, returnedValues[index]);
		});
		assert.equal(engine.searches.length, 0);
	});

	test('refuses a router callback that returns a promise, which construction cannot detect', async () => {
		// Given a router built with a non-async function returning a promise of a valid filter
		const returned = Promise.resolve(STUDY_A({}));
		const { context, engine } = await routerContext({ getServerSideFilter: () => returned });

		// When getAllData is called on its context with nothing
		const refusal = await refusalOf(() => getAllData({ ctx: context, sqon: null }));

		// Then the promise is refused rather than read as a filter, carrying it as the cause
		assert.equal(refusal.name, 'AccessControlError');
		assert.equal(refusal.cause, returned);
		assert.equal(engine.searches.length, 0);
	});

	test("evaluates the router's callback and the caller's against the context the export was given", async () => {
		// Given counting callbacks on the router and from the caller, and a router context an application added a field to
		const routerCallback = countingCallback(STUDY_A);
		const callerCallback = countingCallback(FIRST_TWO);
		const { context } = await routerContext({ getServerSideFilter: routerCallback.callback });
		const exportContext = { ...context, principal: 'the requesting user' };

		// When getAllData exports on that context with the caller's callback
		await exportedIds({ ctx: exportContext, getServerSideFilter: callerCallback.callback });

		// Then each callback saw that context, so a filter derived from a request's identity can read it
		assert.equal((routerCallback.calls[0] as RequestContext | undefined)?.principal, 'the requesting user');
		assert.equal((callerCallback.calls[0] as RequestContext | undefined)?.principal, 'the requesting user');
	});

	test("evaluates the router's callback and the caller's once each, however many pages", async () => {
		// Given counting callbacks on the router and from the caller, whose intersection spans two pages of one row
		const routerCallback = countingCallback(STUDY_A);
		const callerCallback = countingCallback(FIRST_THREE);
		const { context, engine } = await routerContext({ getServerSideFilter: routerCallback.callback });

		// When getAllData exports one row per page
		const ids = await exportedIds({ chunkSize: 1, ctx: context, getServerSideFilter: callerCallback.callback });

		// Then both filters applied across every page, and each callback ran exactly once
		assert.deepEqual(ids, ['DO_01', 'DO_03']);
		assert.ok(engine.searches.length >= 2, 'precondition: the export spanned more than one page');
		assert.equal(routerCallback.calls.length, 1);
		assert.equal(callerCallback.calls.length, 1);
	});

	test("evaluates the router's callback and the caller's once each in dataStream, however many pages", async () => {
		// Given counting callbacks on the router and from the caller, whose intersection spans two pages of one row
		const routerCallback = countingCallback(STUDY_A);
		const callerCallback = countingCallback(FIRST_THREE);
		const { context, engine } = await routerContext({ getServerSideFilter: routerCallback.callback });

		// When dataStream exports a TSV one row per page
		const ids = await dataStreamIds({
			ctx: context,
			getServerSideFilter: callerCallback.callback,
			params: tsvParameters({ chunkSize: 1 }),
		});

		// Then both filters applied across every page, and each callback ran exactly once for the whole export
		assert.deepEqual(ids, ['DO_01', 'DO_03']);
		assert.ok(engine.searches.length >= 2, 'precondition: the export spanned more than one page');
		assert.equal(routerCallback.calls.length, 1);
		assert.equal(callerCallback.calls.length, 1);
	});

	test("evaluates the router's callback once per /download request, however many pages", async () => {
		// Given a router with a counting callback
		const routerCallback = countingCallback(STUDY_A);
		const { app, engine } = await routerContext({ getServerSideFilter: routerCallback.callback });

		// When a download paged one row at a time is requested, and then requested again
		const first = await download(app, tsvParameters({ chunkSize: 1 }));
		const callsAfterFirst = routerCallback.calls.length;
		const searchesForFirst = engine.searches.length;
		const second = await download(app, tsvParameters({ chunkSize: 1 }));

		// Then each request evaluated the callback exactly once, across all its pages
		assert.equal(first.status, 200);
		assert.deepEqual(idsFromTsv(first.text), STUDY_A_IDS);
		assert.ok(searchesForFirst >= STUDY_A_IDS.length, 'precondition: the first export spanned several pages');
		assert.equal(callsAfterFirst, 1);
		assert.equal(second.status, 200);
		assert.equal(routerCallback.calls.length, 2);
	});

	test('answers a download whose router callback throws with a server error before any row', async () => {
		// Given a router whose callback throws with detail a client must not see
		const { app, engine } = await routerContext({
			getServerSideFilter: () => {
				throw new Error(SECRET_DETAIL);
			},
		});

		// When a download is requested
		const response = await download(app, tsvParameters());

		// Then the refusal is a server error carrying no row and no detail, and nothing was searched
		assert.equal(response.status, 500);
		assert.deepEqual(idsFromTsv(response.text), []);
		assert.ok(!response.text.includes(SECRET_DETAIL), `the response carried the detail: ${response.text}`);
		assert.equal(engine.searches.length, 0);
	});

	test("refuses a caller callback whose promise rejects, and the next export succeeds", async () => {
		// Given a hand-built context, a caller callback returning a promise that rejects, and a record of process error events
		const { context } = await routerContext();
		const handBuilt = contextWithoutRecord(context);
		const watcher = recordProcessErrors();

		try {
			// When getAllData is given that callback, and then an ordinary export follows
			const refusal = await refusalOf(() =>
				getAllData({
					ctx: handBuilt,
					getServerSideFilter: (() => Promise.reject(new Error(SECRET_DETAIL))) as never,
					sqon: null,
				}),
			);
			await afterPendingRejections();
			const followUp = await exportedIds({ ctx: handBuilt, getServerSideFilter: FIRST_TWO });

			// Then the call was refused, the process recorded no error event, and the next export succeeds
			assert.equal(refusal.name, 'AccessControlError');
			assert.deepEqual(watcher.faults, []);
			assert.deepEqual(followUp, ['DO_01', 'DO_02']);
		} finally {
			watcher.stop();
		}
	});

	test("answers a download with 500 when the router callback's promise rejects, and the app answers the next request", async () => {
		// Given a router whose callback returns a promise that rejects, and a record of process error events
		const routerCallback = countingCallback(() => Promise.reject(new Error(SECRET_DETAIL)));
		const { app } = await routerContext({ getServerSideFilter: routerCallback.callback });
		const watcher = recordProcessErrors();

		try {
			// When a download is requested, and the app is asked something else afterwards
			const response = await download(app, tsvParameters());
			await afterPendingRejections();
			const followUp = await request(app).get('/context');

			// Then the callback was evaluated and refused with a server error, the process recorded no error event, and the app answers the next request
			assert.equal(routerCallback.calls.length, 1);
			assert.equal(response.status, 500);
			assert.ok(!response.text.includes(SECRET_DETAIL), `the response carried the detail: ${response.text}`);
			assert.deepEqual(watcher.faults, []);
			assert.equal(followUp.status, 200);
		} finally {
			watcher.stop();
		}
	});
});
