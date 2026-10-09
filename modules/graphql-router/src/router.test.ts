import assert from 'node:assert/strict';
import { mock, suite, test } from 'node:test';
import { text as textOf } from 'node:stream/consumers';
import { format } from 'node:util';

import { tableDefaults, tableProperties } from '@overture-stack/arranger-types/configs/constants';
import express, { type Request, type RequestHandler, type Router } from 'express';
import request from 'supertest';

import { restrictingFilter } from '#accessControl/serverSideFilters.fixture.js';
import fallbackCatalogConfigs from '#config/constants.js';
import * as packageRoot from '#index.js';
import type { SearchClient } from '#searchClient/index.js';

import { dataStream } from './download/index.js';
import { FALLBACK_LABEL } from './graphqlRoutes.js';
import arrangerRouter, { mergeConfigs, resolveLabel } from './router.js';

type StoredDocument = { _id: string; _source: Record<string, string> };
type SearchQuery = Record<string, any>;
type SearchParameters = {
	body?: { aggs?: Record<string, SearchQuery>; query?: SearchQuery; search_after?: string[] };
	from?: number;
	index: string;
	size?: number;
};
type RequestContext = Record<string | symbol, unknown>;

const ACCESS_CONTROL_RECORD = Symbol.for('@overture-stack/arranger-graphql-router/accessControl');
const CATALOGUE_CONFIGS = { documentType: 'donor', esIndex: 'donor_index' };
const MAPPING = { donor_id: { type: 'keyword' }, study: { type: 'keyword' } };

const DOCUMENTS: StoredDocument[] = ['A', 'B', 'A', 'B', 'A'].map((study, index) => ({
	_id: `DO_0${index + 1}`,
	_source: { donor_id: `DO_0${index + 1}`, study },
}));
const PERMITTED_IDS = ['DO_01', 'DO_03', 'DO_05'];
const STUDY_A = restrictingFilter({ fieldName: 'study', values: ['A'] });

const HITS_QUERY = '{ donor { hits(first: 100) { total edges { node { donor_id } } } } }';
const AGGREGATIONS_QUERY = `query ($filters: JSON) {
	donor {
		aggregations(filters: $filters, aggregations_filter_themselves: false) {
			donor_id { buckets { key doc_count } }
			study { buckets { key doc_count } }
		}
	}
}`;
const SAVE_SET_MUTATION = 'mutation { saveSet(type: donor, sqon: {}, path: "donor_id") { ids size } }';
const NETWORK_QUERY = '{ network { nodes { name hits } aggregations { study { buckets { key doc_count } } } } }';

const valuesOf = (document: StoredDocument, fieldName: string): unknown[] =>
	fieldName === '_id' ? [document._id] : [document._source[fieldName]].filter((value) => value !== undefined);

const asList = (clauses: unknown): SearchQuery[] => (clauses === undefined ? [] : ([clauses].flat() as SearchQuery[]));

/**
 * Evaluates the part of the query DSL a compiled SQON uses, so a test can assert which documents a
 * search returns rather than what its query looks like. Anything else throws, so an unfamiliar
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

/** Computes the terms, missing, filter and global aggregations Arranger requests, over `documents`. */
const aggregate = (aggregations: Record<string, SearchQuery>, documents: StoredDocument[]): Record<string, unknown> =>
	Object.fromEntries(
		Object.entries(aggregations).map(([name, specification]) => {
			const scoped =
				'global' in specification
					? DOCUMENTS
					: 'filter' in specification
						? documents.filter((document) => matchesQuery(document, specification.filter))
						: documents;
			const nested = specification.aggs ? aggregate(specification.aggs, scoped) : {};

			if ('terms' in specification) {
				const counts = scoped
					.flatMap((document) => valuesOf(document, specification.terms.field))
					.reduce<
						Record<string, number>
					>((tally, value) => ({ ...tally, [String(value)]: (tally[String(value)] ?? 0) + 1 }), {});
				return [
					name,
					{ buckets: Object.entries(counts).map(([key, doc_count]) => ({ doc_count, key })), ...nested },
				];
			}

			if ('missing' in specification) {
				return [
					name,
					{
						doc_count: scoped.filter(
							(document) => valuesOf(document, specification.missing.field).length === 0,
						).length,
					},
				];
			}

			if ('global' in specification || 'filter' in specification) {
				return [name, { doc_count: scoped.length, ...nested }];
			}

			throw new Error(`The stub search engine cannot aggregate ${JSON.stringify(specification)}`);
		}),
	);

/** What the stub engine answers a search with: the matching documents in _id order, paged by size and search_after. */
const searchResponse = (parameters: SearchParameters) => {
	const matched = DOCUMENTS.filter((document) => matchesQuery(document, parameters.body?.query));
	const after = parameters.body?.search_after?.at(-1);
	const remaining = after === undefined ? matched : matched.filter(({ _id }) => _id > after);
	const from = parameters.from ?? 0;
	const page = remaining.slice(from, from + (parameters.size ?? 10));

	return {
		_shards: { failed: 0, successful: 1, total: 1 },
		aggregations: parameters.body?.aggs ? aggregate(parameters.body.aggs, matched) : undefined,
		hits: {
			hits: page.map((document) => ({
				_id: document._id,
				_index: parameters.index,
				_source: { ...document._source },
				sort: [document._id],
			})),
			total: { relation: 'eq', value: matched.length },
		},
		timed_out: false,
		took: 1,
	};
};

/** A search engine over DOCUMENTS that evaluates each query, recording every search and every stored set. */
const createSearchEngine = () => {
	const searches: SearchParameters[] = [];
	const storedSets: { body: { ids: string[] } }[] = [];
	const client = {
		cat: { aliases: async () => ({ body: [] }) },
		index: async (parameters: { body: { ids: string[] } }) => {
			storedSets.push(parameters);
			return { body: { result: 'created' } };
		},
		indices: {
			getMapping: async ({ index }: { index: string }) => ({
				body: { [index]: { mappings: { properties: MAPPING } } },
			}),
		},
		search: async (parameters: SearchParameters) => {
			searches.push(parameters);
			return { body: searchResponse(parameters) };
		},
	} as unknown as SearchClient;

	return { client, searches, storedSets };
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

type BuiltRouter = { engine: ReturnType<typeof createSearchEngine>; router: Router };

/**
 * Builds a router for each entry of `settingsList` concurrently, each over its own stub engine, the
 * way a multicatalogue server loads its catalogues. Each entry is spread into the router's
 * arguments, so leaving `getServerSideFilter` out of it passes nothing at all. The result has one
 * router per entry, in order, so a list written out in the call reads back as a tuple.
 */
const buildRouters = <const SettingsList extends readonly Record<string, unknown>[]>(
	settingsList: SettingsList,
): Promise<{ lines: string[]; result: { -readonly [Index in keyof SettingsList]: BuiltRouter } }> =>
	withConsoleCaptured(
		() =>
			Promise.all(
				settingsList.map(async (settings: Record<string, unknown>): Promise<BuiltRouter> => {
					const engine = createSearchEngine();
					const router = await arrangerRouter({
						configs: CATALOGUE_CONFIGS,
						esClient: engine.client,
						...settings,
					});
					return { engine, router };
				}),
			) as Promise<{ -readonly [Index in keyof SettingsList]: BuiltRouter }>,
	);

const buildRouter = async (settings: Record<string, unknown> = {}) => {
	const {
		lines,
		result: [built],
	} = await buildRouters([settings]);

	return { ...built, logLines: lines };
};

/** Why constructing a router with `getServerSideFilter` failed, or undefined when it built. */
const constructionFailureFor = async (getServerSideFilter: unknown): Promise<unknown> => {
	const { result } = await withConsoleCaptured(() =>
		arrangerRouter({
			configs: CATALOGUE_CONFIGS,
			esClient: createSearchEngine().client,
			getServerSideFilter: getServerSideFilter as never,
		}).then(
			() => undefined,
			(error: unknown) => error,
		),
	);

	return result;
};

/** An error's message followed by every message in its cause chain. */
const messageChainOf = (error: unknown): string =>
	error instanceof Error ? [error.message, messageChainOf(error.cause)].filter(Boolean).join(' <- ') : '';

const contextOf = (req: Request): RequestContext => (req as unknown as { context: RequestContext }).context;

/** An app mounting `router` at its root with a route after it, as an application's own export route sits, reporting the request context it sees. */
const appWithContextProbe = ({ beforeRouter, router }: { beforeRouter?: RequestHandler; router: Router }) => {
	const contexts: RequestContext[] = [];
	const app = express();

	if (beforeRouter) {
		app.use(beforeRouter);
	}

	app.use(router);
	app.get('/context', (req, res) => {
		contexts.push(contextOf(req));
		res.end();
	});

	return {
		app,
		nextContext: async (): Promise<RequestContext | undefined> => {
			await request(app).get('/context');
			return contexts.at(-1);
		},
	};
};

const accessControlLinesIn = (lines: string[]) => lines.filter((line) => line.includes('access control:'));

const assertOnlyAccessControlLine = (lines: string[], expected: string) => {
	const accessControlLines = accessControlLinesIn(lines);

	assert.equal(
		accessControlLines.length,
		1,
		`expected one access control line, got ${JSON.stringify(accessControlLines)}`,
	);
	assert.ok(
		accessControlLines[0]?.includes(expected),
		`expected "${expected}", got ${JSON.stringify(accessControlLines)}`,
	);
};

const postGraphQL = (router: Router, query: string, variables?: Record<string, unknown>) =>
	request(express().use(router)).post('/graphql').send({ query, variables });

const hitIdsOf = (response: request.Response): string[] =>
	response.body.data.donor.hits.edges.map(({ node }: { node: { donor_id: string } }) => node.donor_id);

const PERMITTED_STUDY_HEADER = 'x-permitted-study';

/** Permits the study a request names in a header, the way a callback derives a filter from a request's identity. */
const studyNamedByRequest = (context: unknown) => {
	const headers = (context as { request?: { headers?: Headers } } | undefined)?.request?.headers;
	return restrictingFilter({ fieldName: 'study', values: [headers?.get(PERMITTED_STUDY_HEADER) ?? 'none named'] })(
		context,
	);
};

suite('mergeConfigs', () => {
	test('preserves all fallback properties when custom config is empty', () => {
		const result = mergeConfigs(fallbackCatalogConfigs, {});

		assert.deepEqual(result, fallbackCatalogConfigs);
	});

	test('custom top-level value overrides fallback', () => {
		const custom = { esHost: 'http://custom:9200' };

		const result = mergeConfigs(fallbackCatalogConfigs, custom);

		assert.equal(result.esHost, 'http://custom:9200');
	});

	test('partial sub-object in custom does not drop sibling fallback properties', () => {
		const custom = {
			table: {
				[tableProperties.MAX_RESULTS_WINDOW]: 5000,
			},
		};

		const result = mergeConfigs(fallbackCatalogConfigs, custom);

		assert.equal(result.table?.[tableProperties.MAX_RESULTS_WINDOW], 5000);
		assert.equal(result.table?.[tableProperties.ROW_ID_FIELD_NAME], tableDefaults.ROW_ID_FIELD_NAME);
	});

	test('custom sub-object value overrides fallback sub-object value', () => {
		const custom = {
			table: {
				[tableProperties.ROW_ID_FIELD_NAME]: 'analysis__analysis_id',
			},
		};

		const result = mergeConfigs(fallbackCatalogConfigs, custom);

		assert.equal(result.table?.[tableProperties.ROW_ID_FIELD_NAME], 'analysis__analysis_id');
		assert.equal(result.table?.[tableProperties.MAX_RESULTS_WINDOW], tableDefaults.MAX_RESULTS_WINDOW);
	});

	test('does not mutate the fallback input', () => {
		const fallback = { esHost: 'http://original:9200', table: { [tableProperties.MAX_RESULTS_WINDOW]: 10000 } };
		const custom = { esHost: 'http://custom:9200' };

		mergeConfigs(fallback, custom);

		assert.equal(fallback.esHost, 'http://original:9200');
	});

	test('does not mutate the custom input', () => {
		const custom = { table: { [tableProperties.MAX_RESULTS_WINDOW]: 5000 } };

		mergeConfigs(fallbackCatalogConfigs, custom);

		assert.equal(custom.table[tableProperties.MAX_RESULTS_WINDOW], 5000);
		assert.equal((custom.table as Record<string, unknown>)[tableProperties.ROW_ID_FIELD_NAME], undefined);
	});
});

suite('resolveLabel', () => {
	test('prefers catalogueId when provided', () => {
		const result = resolveLabel({ catalogueId: 'donor', documentType: 'participant' });

		assert.equal(result, 'donor');
	});

	test('falls back to documentType when catalogueId is not provided', () => {
		const result = resolveLabel({ documentType: 'participant' });

		assert.equal(result, 'participant');
	});

	test('falls back to the placeholder when neither catalogueId nor documentType is provided', () => {
		const result = resolveLabel({});

		assert.equal(result, FALLBACK_LABEL);
	});
});

suite('arrangerRouter accepts only undefined or a non-async function as getServerSideFilter', () => {
	test('builds and serves reads when getServerSideFilter is omitted, explicitly undefined, or a function', async () => {
		// Given the three accepted forms
		const settingsList = [{}, { getServerSideFilter: undefined }, { getServerSideFilter: STUDY_A }];

		// When a router is built with each and asked for hits
		const { result: routers } = await buildRouters(settingsList);
		const responses = await Promise.all(routers.map(({ router }) => postGraphQL(router, HITS_QUERY)));

		// Then each answers without errors
		responses.forEach((response) => {
			assert.equal(response.status, 200);
			assert.equal(response.body.errors, undefined);
		});
	});

	test('refuses every other value at construction, naming its type', async () => {
		// Given values that are neither undefined nor a function, and the type each should be named by
		const cases: [string, unknown, string][] = [
			['false', false, 'boolean'],
			['true', true, 'boolean'],
			['zero', 0, 'number'],
			['an empty string', '', 'string'],
			['a string', 'includeEverything', 'string'],
			['a symbol', Symbol('includeEverything'), 'symbol'],
			['a plain object', {}, 'object'],
			['an array holding a filter function', [STUDY_A], 'object'],
			['a SQON object', { content: { fieldName: 'study', value: ['A'] }, op: 'in' }, 'object'],
		];

		// When a router is constructed with each
		const outcomes = await Promise.all(
			cases.map(async ([description, value, typeName]) => {
				const failure = await constructionFailureFor(value);
				const message = messageChainOf(failure);
				return {
					description,
					message,
					namesType: failure instanceof Error && new RegExp(`\\b${typeName}\\b`).test(message),
					typeName,
				};
			}),
		);

		// Then every construction rejects with a message naming the value's type
		assert.deepEqual(
			outcomes.filter(({ namesType }) => !namesType).map(({ description }) => description),
			[],
		);

		// And the message depends on that type, so one fixed list of every type name cannot pass for naming it
		const messagesByType = new Map(outcomes.map(({ message, typeName }) => [typeName, message]));
		assert.equal(new Set(messagesByType.values()).size, messagesByType.size, JSON.stringify([...messagesByType]));
	});

	test('refuses null at construction, naming it null rather than object', async () => {
		// Given null, which typeof reports as an object
		// When a router is constructed with it
		const failure = await constructionFailureFor(null);

		// Then construction rejects, calling the value null
		assert.ok(failure instanceof Error, 'expected construction to reject');
		assert.match(messageChainOf(failure), /\bnull\b/);
		assert.doesNotMatch(messageChainOf(failure), /\bobject\b/);
	});

	test('refuses an async function at construction, since every filter it returns would be a promise', async () => {
		// Given an async function returning a valid filter
		// When a router is constructed with it
		const failure = await constructionFailureFor(async (context: unknown) => STUDY_A(context));

		// Then construction rejects, saying why
		assert.ok(failure instanceof Error, 'expected construction to reject');
		assert.match(messageChainOf(failure), /\basync\b/i);
	});
});

suite("the router's access-control record on the request context", () => {
	test('records a configured function by identity, as configured', async () => {
		// Given a router built with a restricting function
		const { router } = await buildRouter({ getServerSideFilter: STUDY_A });

		// When a route mounted after it reads the request context
		const context = await appWithContextProbe({ router }).nextContext();

		// Then the record holds that very function, marked configured
		assert.deepEqual(context?.[ACCESS_CONTROL_RECORD], { getServerSideFilter: STUDY_A, source: 'configured' });
	});

	test('records includeEverything as defaulted when nothing was passed, or undefined was', async () => {
		// Given routers built with getServerSideFilter left out and set to undefined
		const { result: routers } = await buildRouters([{}, { getServerSideFilter: undefined }]);

		// When a route after each reads the request context
		const contexts = await Promise.all(routers.map(({ router }) => appWithContextProbe({ router }).nextContext()));

		// Then each record holds includeEverything, marked defaulted
		assert.equal(typeof packageRoot.includeEverything, 'function');
		contexts.forEach((context) =>
			assert.deepEqual(context?.[ACCESS_CONTROL_RECORD], {
				getServerSideFilter: packageRoot.includeEverything,
				source: 'defaulted',
			}),
		);
	});

	test('records includeEverything passed explicitly as configured, because the router has no default value', async () => {
		// Given a router built with includeEverything itself
		assert.equal(typeof packageRoot.includeEverything, 'function');
		const { router } = await buildRouter({ getServerSideFilter: packageRoot.includeEverything });

		// When a route after it reads the request context
		const context = await appWithContextProbe({ router }).nextContext();

		// Then the deployment's explicit choice is recorded as configured, not as a default
		assert.deepEqual(context?.[ACCESS_CONTROL_RECORD], {
			getServerSideFilter: packageRoot.includeEverything,
			source: 'configured',
		});
	});

	test('records the decision on every request, under the registry symbol and under no string key', async () => {
		// Given a router built with a restricting function
		const { router } = await buildRouter({ getServerSideFilter: STUDY_A });
		const probe = appWithContextProbe({ router });

		// When two requests pass through it
		const contexts = [await probe.nextContext(), await probe.nextContext()];

		// Then each carries the record, reachable only through the symbol, so JSON can neither carry nor forge it
		contexts.forEach((context) => {
			const record = context?.[ACCESS_CONTROL_RECORD];
			assert.deepEqual(record, { getServerSideFilter: STUDY_A, source: 'configured' });
			assert.ok(Object.getOwnPropertySymbols(context).includes(ACCESS_CONTROL_RECORD));
			assert.deepEqual(
				Object.keys(context ?? {}).filter((key) => context?.[key] === record),
				[],
			);
		});
	});

	test('survives a shallow copy of the context', async () => {
		// Given the context a route after a restricting router sees
		const { router } = await buildRouter({ getServerSideFilter: STUDY_A });
		const context = await appWithContextProbe({ router }).nextContext();
		assert.deepEqual(context?.[ACCESS_CONTROL_RECORD], { getServerSideFilter: STUDY_A, source: 'configured' });

		// When an application copies it by spread and by Object.assign
		const copies = [{ ...context }, Object.assign({}, context)];

		// Then each copy carries the same record
		copies.forEach((copy) => assert.equal(copy[ACCESS_CONTROL_RECORD], context?.[ACCESS_CONTROL_RECORD]));
	});

	test('keeps a field the application set on the context before the router, beside the record', async () => {
		// Given application middleware that sets a field on the context before the router runs
		const { router } = await buildRouter({ getServerSideFilter: STUDY_A });
		const beforeRouter: RequestHandler = (req, _res, next) => {
			(req as unknown as { context: RequestContext }).context = { tenant: 'kept' };
			next();
		};

		// When a route after the router reads the context
		const context = await appWithContextProbe({ beforeRouter, router }).nextContext();

		// Then the application's field survives the merge, and the router's record is there too
		assert.equal(context?.tenant, 'kept');
		assert.deepEqual(context?.[ACCESS_CONTROL_RECORD], { getServerSideFilter: STUDY_A, source: 'configured' });
	});

	test('replaces a record, client and configs the application set before the router with its own', async () => {
		// Given application middleware that pre-sets the router's own keys, including a forged permissive record
		const { engine, router } = await buildRouter({ getServerSideFilter: STUDY_A });
		const applicationClient = createSearchEngine().client;
		const beforeRouter: RequestHandler = (req, _res, next) => {
			(req as unknown as { context: RequestContext }).context = {
				[ACCESS_CONTROL_RECORD]: {
					getServerSideFilter: () => ({ content: [], op: 'and' }),
					source: 'defaulted',
				},
				configs: 'set by the application',
				esClient: applicationClient,
			};
			next();
		};

		// When a route after the router reads the context
		const context = await appWithContextProbe({ beforeRouter, router }).nextContext();

		// Then the router's keys win on every collision
		assert.deepEqual(context?.[ACCESS_CONTROL_RECORD], { getServerSideFilter: STUDY_A, source: 'configured' });
		assert.equal(context?.esClient, engine.client);
		assert.notEqual(context?.configs, 'set by the application');
	});

	test("keeps each router's record separate when two are built concurrently in one process", async () => {
		// Given a restricting router and a defaulted one, built concurrently and mounted side by side
		const {
			result: [restricting, defaulted],
		} = await buildRouters([{ getServerSideFilter: STUDY_A }, {}]);
		const probes = {
			a: appWithContextProbe({ router: restricting.router }),
			b: appWithContextProbe({ router: defaulted.router }),
		};

		// When a route after each reads its context
		const contexts = { a: await probes.a.nextContext(), b: await probes.b.nextContext() };

		// Then each context carries its own router's decision
		assert.deepEqual(contexts.a?.[ACCESS_CONTROL_RECORD], { getServerSideFilter: STUDY_A, source: 'configured' });
		assert.deepEqual(contexts.b?.[ACCESS_CONTROL_RECORD], {
			getServerSideFilter: packageRoot.includeEverything,
			source: 'defaulted',
		});
	});
});

suite('the startup log line for access control', () => {
	test('reads "access control: filter configured" for a configured function', async () => {
		// Given a restricting function
		// When a router is built with it
		const { logLines } = await buildRouter({ getServerSideFilter: STUDY_A });

		// Then exactly one access-control line is logged, in the configured form
		assertOnlyAccessControlLine(logLines, 'access control: filter configured');
	});

	test('reads "access control: none (explicit)" for includeEverything and its deprecated alias', async () => {
		// Given includeEverything and getDefaultServerSideFilter, one function under two names
		assert.equal(typeof packageRoot.includeEverything, 'function');

		// When a router is built with each
		const builds = [
			await buildRouter({ getServerSideFilter: packageRoot.includeEverything }),
			await buildRouter({ getServerSideFilter: packageRoot.getDefaultServerSideFilter }),
		];

		// Then each logs the explicit form
		builds.forEach(({ logLines }) => assertOnlyAccessControlLine(logLines, 'access control: none (explicit)'));
	});

	test('reports a wrapper around includeEverything as a configured filter, recognizing includeEverything by identity alone', async () => {
		// Given a function that behaves exactly like includeEverything without being it
		assert.equal(typeof packageRoot.includeEverything, 'function');
		const includeEverything = packageRoot.includeEverything;
		const wrapper = (context: unknown) => includeEverything(context as never);

		// When a router is built with it
		const { logLines } = await buildRouter({ getServerSideFilter: wrapper });

		// Then it is reported as configured, since behaviour is never inspected
		assertOnlyAccessControlLine(logLines, 'access control: filter configured');
	});

	test('reads "access control: none (defaulted)" when nothing was passed, or undefined was', async () => {
		// Given getServerSideFilter left out, and set to undefined
		// When a router is built with each
		const builds = [await buildRouter({}), await buildRouter({ getServerSideFilter: undefined })];

		// Then each logs the defaulted form
		builds.forEach(({ logLines }) => assertOnlyAccessControlLine(logLines, 'access control: none (defaulted)'));
	});

	test('logs one line per catalogue when several are built at once, and none per request', async () => {
		// Given a restricting catalogue and a defaulted one, built concurrently
		const { lines, result: routers } = await buildRouters([{ getServerSideFilter: STUDY_A }, {}]);

		// When each then serves a request
		const { lines: requestLines } = await withConsoleCaptured(() =>
			Promise.all(routers.map(({ router }) => postGraphQL(router, HITS_QUERY).then((response) => response))),
		);

		// Then construction logged one line for each catalogue, and serving logged none
		const constructionLines = accessControlLinesIn(lines);
		assert.equal(constructionLines.length, 2, JSON.stringify(constructionLines));
		assert.ok(constructionLines.some((line) => line.includes('access control: filter configured')));
		assert.ok(constructionLines.some((line) => line.includes('access control: none (defaulted)')));
		assert.deepEqual(accessControlLinesIn(requestLines), []);
	});
});

suite("a restricting filter reaches the search engine on each of the router's read paths", () => {
	test('hits return only the documents the filter permits', async () => {
		// Given a router built with a filter permitting study A
		const { router } = await buildRouter({ getServerSideFilter: STUDY_A });

		// When hits are queried
		const response = await postGraphQL(router, HITS_QUERY);

		// Then only study A's documents come back
		assert.deepEqual(hitIdsOf(response), PERMITTED_IDS);
		assert.equal(response.body.data.donor.hits.total, PERMITTED_IDS.length);
	});

	test("hits apply the filter the callback derives from each request's own context", async () => {
		// Given a router whose callback permits the study each request names in a header
		const { router } = await buildRouter({ getServerSideFilter: studyNamedByRequest });
		const app = express().use(router);

		// When one request naming study B and then one naming study A query hits
		const studyB = await request(app).post('/graphql').set(PERMITTED_STUDY_HEADER, 'B').send({ query: HITS_QUERY });
		const studyA = await request(app).post('/graphql').set(PERMITTED_STUDY_HEADER, 'A').send({ query: HITS_QUERY });

		// Then each sees only its own study, so the callback ran for each request, against that request
		assert.deepEqual(hitIdsOf(studyB), ['DO_02', 'DO_04']);
		assert.deepEqual(hitIdsOf(studyA), PERMITTED_IDS);
	});

	test("aggregations count only permitted documents, including the facet on the filter's own field", async () => {
		// Given a router built with a filter on study, and no client filter naming study
		const { engine, router } = await buildRouter({ getServerSideFilter: STUDY_A });

		// When both facets are requested
		const response = await postGraphQL(router, AGGREGATIONS_QUERY);

		// Then the study facet counted within the search query, where the filter applies whole, and both
		// facets count only permitted documents
		const aggregationSearch = engine.searches.find((search) => search.body?.aggs);
		assert.ok(
			!Object.keys(aggregationSearch?.body?.aggs ?? {}).some((name) => name.endsWith(':global')),
			'precondition: with no client filter on it, the facet on the filtered field is computed within the search query',
		);
		assert.deepEqual(response.body.data.donor.aggregations.study.buckets, [{ doc_count: 3, key: 'A' }]);
		assert.deepEqual(
			response.body.data.donor.aggregations.donor_id.buckets.map(({ key }: { key: string }) => key),
			PERMITTED_IDS,
		);
	});

	test("a client filter on the filter's own field cannot lift it from that field's facet", async () => {
		// Given the same router, and a client filter asking for study B
		const { engine, router } = await buildRouter({ getServerSideFilter: STUDY_A });
		const filters = { content: [{ content: { fieldName: 'study', value: ['B'] }, op: 'in' }], op: 'and' };

		// When both facets are requested under that filter
		const response = await postGraphQL(router, AGGREGATIONS_QUERY, { filters });

		// Then the study facet, computed outside the search query, still shows only study A, and the other
		// facet shows nothing
		const aggregationSearch = engine.searches.find((search) => search.body?.aggs);
		assert.ok(
			Object.keys(aggregationSearch?.body?.aggs ?? {}).some((name) => name.endsWith(':global')),
			"precondition: the client filter on the facet's field moves that facet outside the search query",
		);
		assert.deepEqual(response.body.data.donor.aggregations.study.buckets, [{ doc_count: 3, key: 'A' }]);
		assert.deepEqual(response.body.data.donor.aggregations.donor_id.buckets, []);
	});

	test('saveSet stores only the ids the filter permits', async () => {
		// Given a router built with a filter permitting study A
		const { engine, router } = await buildRouter({ getServerSideFilter: STUDY_A });

		// When a set is saved from an empty sqon
		const response = await postGraphQL(router, SAVE_SET_MUTATION);

		// Then the returned and stored ids are study A's alone
		assert.deepEqual(response.body.data.saveSet.ids, PERMITTED_IDS);
		assert.deepEqual(engine.storedSets[0]?.body.ids, PERMITTED_IDS);
	});

	test('network search counts only permitted documents on the local node', async () => {
		// Given a router with network search over its own catalogue, built with a filter permitting study A
		const { router } = await buildRouter({
			configs: { ...CATALOGUE_CONFIGS, network: { localNode: { displayName: 'local node' } } },
			getServerSideFilter: STUDY_A,
		});

		// When the network is queried
		const response = await postGraphQL(router, NETWORK_QUERY);

		// Then the local node reports study A's count, and the merged facet holds study A alone
		assert.equal(response.body.data.network.nodes[0].hits, PERMITTED_IDS.length);
		assert.deepEqual(response.body.data.network.aggregations.study.buckets, [{ doc_count: 3, key: 'A' }]);
	});
});

/** Permits the study an application recorded for the request, as an access-control middleware hands a router its result. */
const studyOnRequestContext = (context: unknown) =>
	restrictingFilter({
		fieldName: 'study',
		values: [String((context as { permittedStudy?: unknown } | undefined)?.permittedStudy ?? 'none recorded')],
	})(context);

/** Records study A in `res.locals` before the router, as an application's own middleware does. */
const recordStudyA: RequestHandler = (_req, res, next) => {
	res.locals.permittedStudy = 'A';
	next();
};

/** An application that records study A for each request before the router. */
const appRecordingStudyA = (router: Router, recordStudy: RequestHandler = recordStudyA) =>
	express()
		.use(express.urlencoded({ extended: false }))
		.use(recordStudy)
		.use(router);

const DONOR_EXPORT_PARAMS = {
	fileName: '',
	files: [
		{
			columns: [
				{
					accessor: 'donor_id',
					canChangeShow: true,
					displayName: 'Donor',
					fieldName: 'donor_id',
					isArray: false,
					jsonPath: null,
					query: null,
					show: true,
					sortable: true,
					type: 'keyword',
				},
			],
			documentType: 'donor',
			fileName: 'donors.tsv',
			fileType: 'tsv',
			maxRows: 0,
			sqon: null,
		},
	],
};

suite('a filter callback reads what an application recorded in res.locals, on every read path', () => {
	test('hits apply the filter the callback derives from the request context', async () => {
		// Given a router whose callback permits the study recorded on the request context, behind an application recording study A
		const { router } = await buildRouter({ getServerSideFilter: studyOnRequestContext });

		// When hits are queried
		const response = await request(appRecordingStudyA(router)).post('/graphql').send({ query: HITS_QUERY });

		// Then only study A's documents come back
		assert.deepEqual(hitIdsOf(response), PERMITTED_IDS);
	});

	test('aggregations apply the filter the callback derives from the request context', async () => {
		const { router } = await buildRouter({ getServerSideFilter: studyOnRequestContext });

		const response = await request(appRecordingStudyA(router)).post('/graphql').send({ query: AGGREGATIONS_QUERY });

		assert.deepEqual(response.body.data.donor.aggregations.study.buckets, [{ doc_count: 3, key: 'A' }]);
	});

	test('saveSet applies the filter the callback derives from the request context', async () => {
		const { router } = await buildRouter({ getServerSideFilter: studyOnRequestContext });

		const response = await request(appRecordingStudyA(router)).post('/graphql').send({ query: SAVE_SET_MUTATION });

		assert.deepEqual(response.body.data.saveSet.ids, PERMITTED_IDS);
	});

	test('the export applies the filter the callback derives from the request context', async () => {
		const { router } = await buildRouter({ getServerSideFilter: studyOnRequestContext });

		const response = await request(appRecordingStudyA(router))
			.post('/download')
			.type('form')
			.send({ downloadKey: 'a-download-key', httpHeaders: '{}', params: JSON.stringify(DONOR_EXPORT_PARAMS) });

		assert.equal(response.status, 200, response.text);
		assert.deepEqual(response.text.split('\n').filter(Boolean), ['Donor', ...PERMITTED_IDS]);
	});

	test("the router's own context keys take precedence over the application's", async () => {
		// Given a callback permitting the study a request's headers name, behind an application that records
		// a request object of its own naming study B
		const { router } = await buildRouter({ getServerSideFilter: studyNamedByRequest });
		const app = express()
			.use((_req, res, next) => {
				res.locals.request = { headers: new Headers({ [PERMITTED_STUDY_HEADER]: 'B' }) };
				next();
			})
			.use(router);

		// When hits are queried by a request whose own header names study A
		const response = await request(app)
			.post('/graphql')
			.set(PERMITTED_STUDY_HEADER, 'A')
			.send({ query: HITS_QUERY });

		// Then the callback read the router's request, so the application's key never replaced it
		assert.deepEqual(hitIdsOf(response), PERMITTED_IDS);
	});
});

/** Records study A through the deprecated `req.context`, as integrations written before 1.0 do. */
const recordStudyAOnRequestContext = packageRoot.utils.addContext({ permittedStudy: 'A' });

suite('an application writing the deprecated req.context still reaches the filter callback', () => {
	test('hits apply the filter the callback derives from a key written to req.context before the router', async () => {
		const { router } = await buildRouter({ getServerSideFilter: studyOnRequestContext });

		const response = await request(appRecordingStudyA(router, recordStudyAOnRequestContext))
			.post('/graphql')
			.send({ query: HITS_QUERY });

		assert.deepEqual(hitIdsOf(response), PERMITTED_IDS);
	});

	test('the export applies the filter the callback derives from a key written to req.context before the router', async () => {
		const { router } = await buildRouter({ getServerSideFilter: studyOnRequestContext });

		const response = await request(appRecordingStudyA(router, recordStudyAOnRequestContext))
			.post('/download')
			.type('form')
			.send({ downloadKey: 'a-download-key', httpHeaders: '{}', params: JSON.stringify(DONOR_EXPORT_PARAMS) });

		assert.equal(response.status, 200, response.text);
		assert.deepEqual(response.text.split('\n').filter(Boolean), ['Donor', ...PERMITTED_IDS]);
	});

	test('a write through req.context after the router lands in res.locals.arranger, and the reverse', async () => {
		// Given an application route after the router that writes through each store
		const { router } = await buildRouter();
		const app = express()
			.use(router)
			.get('/probe', (req, res) => {
				const legacyContext = (req as unknown as { context: Record<string, unknown> }).context;
				legacyContext.writtenThroughRequest = true;
				res.locals.arranger = Object.assign(res.locals.arranger ?? {}, { writtenThroughLocals: true });
				res.json({
					inLocals: res.locals.arranger.writtenThroughRequest,
					inRequestContext: legacyContext.writtenThroughLocals,
					sameObject: legacyContext === res.locals.arranger,
				});
			});

		// When it runs, Then each write is visible through the other store, since both are one object
		const response = await request(app).get('/probe');
		assert.deepEqual(response.body, { inLocals: true, inRequestContext: true, sameObject: true });
	});
});

/** Reads the access an application's middleware recorded in `res.locals.usher`, as an access-control adapter does. */
const studyFromRecordedAccess = (context: unknown) => {
	const access = (context as { usher?: { permittedStudy?: string } } | undefined)?.usher;

	if (!access?.permittedStudy) {
		throw new Error('No access was recorded for this request.');
	}

	return restrictingFilter({ fieldName: 'study', values: [access.permittedStudy] })(context);
};

suite("an application's own export route behind a callback reading res.locals", () => {
	/** An application recording access in `res.locals.usher`, with an export route reading the store `store` names. */
	const exportApp = (router: Router) =>
		express()
			.use((_req, res, next) => {
				res.locals.usher = { permittedStudy: 'A' };
				next();
			})
			.use(router)
			.get('/export/:store', async (req, res) => {
				const ctx = req.params.store === 'locals' ? res.locals : Reflect.get(req, 'context');
				try {
					const chunks = await packageRoot.utils.getAllData({ ctx, sqon: null });
					const rows: string[] = [];
					for await (const chunk of chunks) {
						rows.push(...chunk.hits.map((hit: { donor_id: string }) => hit.donor_id));
					}
					res.json({ rows });
				} catch (error) {
					res.status(500).json({ error: error instanceof Error ? error.name : String(error) });
				}
			});

	test('exports the permitted rows when the route passes res.locals', async () => {
		const { router } = await buildRouter({ getServerSideFilter: studyFromRecordedAccess });

		const response = await request(exportApp(router)).get('/export/locals');

		assert.deepEqual(response.body, { rows: PERMITTED_IDS });
	});

	test('fails closed, refusing the export, when the route passes the deprecated req.context', async () => {
		// Given access recorded at the root of res.locals, which req.context, Arranger's own namespace, does not hold
		const callback = mock.fn(studyFromRecordedAccess);
		const { router } = await buildRouter({ getServerSideFilter: callback });

		// When the route hands req.context to the export
		const response = await request(exportApp(router)).get('/export/context');

		// Then the router's record reached the export, so the callback ran, found no access, and the export
		// is refused with the access-control failure
		const contextsSeen = callback.mock.calls.map((call) => call.arguments[0] as { usher?: unknown });
		assert.equal(contextsSeen.length, 1, 'the callback never ran, so the export found no access-control record');
		assert.equal(contextsSeen[0]?.usher, undefined);
		assert.equal(response.status, 500, JSON.stringify(response.body));
		assert.deepEqual(response.body, { error: 'AccessControlError' });
	});
});

suite('a configsSource, which the router no longer reads', () => {
	/** Constructs a router with `settings`, resolving with why it failed, or undefined, and the warnings it emitted. */
	const constructWith = async (settings: Record<string, unknown>) => {
		const emitWarning = mock.method(process, 'emitWarning', () => undefined);
		const { result: failure } = await withConsoleCaptured(() =>
			arrangerRouter({ esClient: createSearchEngine().client, ...settings } as never).then(
				() => undefined,
				(error: unknown) => error,
			),
		);
		emitWarning.mock.restore();

		return { failure, warnings: emitWarning.mock.calls.map((call) => String(call.arguments[0])) };
	};

	test('is refused when passed with no configs, naming configs and linking the migration section', async () => {
		// Given a 3.0-style call passing only a path to configuration files
		const { failure } = await constructWith({ configsSource: './configs' });

		// Then construction rejects with what to pass instead, and where the migration is described
		assert.ok(failure instanceof Error, 'expected construction to reject');
		assert.match(failure.message, /configsSource/);
		assert.match(failure.message, /`configs`/);
		assert.ok(failure.message.includes('#arranger-server-package'), failure.message);
	});

	test('counts as absent when empty, building from configs with no warning', async () => {
		const { failure, warnings } = await constructWith({ configs: CATALOGUE_CONFIGS, configsSource: '' });

		assert.equal(failure, undefined);
		assert.deepEqual(warnings, []);
	});

	test('is warned about and ignored when passed beside configs, which the router builds from', async () => {
		// Given a call passing both, as an integration following earlier advice may
		const { failure, warnings } = await constructWith({ configs: CATALOGUE_CONFIGS, configsSource: './configs' });

		// Then the router builds, and one warning says configsSource is not read, naming no removal time
		assert.equal(failure, undefined);
		assert.equal(warnings.length, 1, warnings.join('\n'));
		assert.match(warnings[0] ?? '', /"configsSource" is not read/);
		assert.doesNotMatch(warnings[0] ?? '', /removed|until|future/);
	});
});

const HIDDEN_MEMBER = 'hiddenFromCopies';

/** An app attaching a member to res.locals hidden from copies, as an access layer attaches its result, ahead of `router`. */
const appHidingAMember = (router: Router) => {
	const stores: object[] = [];
	const app = express()
		.use((_req, res, next) => {
			Object.defineProperty(res.locals, HIDDEN_MEMBER, { enumerable: false, value: 'attached' });
			stores.push(res.locals);
			next();
		})
		.use(router);

	return { app, stores };
};

const exportFrom = (app: express.Express) =>
	request(app)
		.post('/download')
		.type('form')
		.send({ downloadKey: 'a-download-key', httpHeaders: '{}', params: JSON.stringify(DONOR_EXPORT_PARAMS) });

type FilterCall = { hidden: unknown; readPath: unknown; store: unknown };

/** A callback permitting everything, recording for each call the read path named and the store given. */
const recordingCallback = () => {
	const calls: FilterCall[] = [];
	const getServerSideFilter = (context: unknown, details?: { readPath?: unknown }) => {
		const locals = (context as { locals?: Record<string, unknown> } | undefined)?.locals;
		calls.push({ hidden: locals?.[HIDDEN_MEMBER], readPath: details?.readPath, store: locals });
		return packageRoot.includeEverything(context);
	};

	return { calls, getServerSideFilter };
};

suite("a filter callback, on each of the router's read paths", () => {
	test("is told its read path and given the request's own store, a member hidden from copies included", async () => {
		// Given a callback recording each call, behind an app attaching a hidden member to res.locals
		const { calls, getServerSideFilter } = recordingCallback();
		const { router } = await buildRouter({
			configs: { ...CATALOGUE_CONFIGS, network: { localNode: { displayName: 'local node' } } },
			getServerSideFilter,
		});
		const { app, stores } = appHidingAMember(router);

		// When hits, aggregations, a saved set, an export and network search are each requested
		await request(app).post('/graphql').send({ query: HITS_QUERY });
		await request(app).post('/graphql').send({ query: AGGREGATIONS_QUERY });
		await request(app).post('/graphql').send({ query: SAVE_SET_MUTATION });
		await exportFrom(app);
		await request(app).post('/graphql').send({ query: NETWORK_QUERY });

		// Then the read paths named are those five, and every call read the hidden member from its request's own store
		assert.deepEqual([...new Set(calls.map(({ readPath }) => String(readPath)))].sort(), [
			'aggregations',
			'export',
			'hits',
			'network',
			'sets',
		]);
		assert.deepEqual(
			calls.filter(({ hidden, store }) => hidden !== 'attached' || !stores.includes(store as object)),
			[],
		);
	});

	test("gives an application's own export route, passing ctx: res.locals, the request's own store", async () => {
		// Given a callback recording each call, and an application export route after the router
		const { calls, getServerSideFilter } = recordingCallback();
		const { router } = await buildRouter({ getServerSideFilter });
		const { app, stores } = appHidingAMember(router);
		app.post('/own-export', express.json(), async (req, res) => {
			const { output } = await dataStream({ ctx: res.locals, params: req.body });
			res.type('text/plain').send(await textOf(output));
		});

		// When the application route exports
		const response = await request(app).post('/own-export').send(DONOR_EXPORT_PARAMS);

		// Then the export ran, and its callback read the hidden member from that request's own store
		assert.equal(response.status, 200, response.text);
		assert.deepEqual(
			calls.map(({ hidden, readPath, store }) => [readPath, hidden, stores.includes(store as object)]),
			[['export', 'attached', true]],
		);
	});

	test("keeps the request's own store when an external context names locals", async () => {
		// Given a router whose external GraphQL context offers a store of its own
		const { calls, getServerSideFilter } = recordingCallback();
		const { router } = await buildRouter({
			getServerSideFilter,
			graphqlOptions: { context: () => ({ locals: { [HIDDEN_MEMBER]: 'replaced' } }) },
		});

		// When hits are requested behind the app attaching the hidden member
		await request(appHidingAMember(router).app).post('/graphql').send({ query: HITS_QUERY });

		// Then the callback still read the request's own store
		assert.deepEqual(
			calls.map(({ hidden }) => hidden),
			['attached'],
		);
	});
});

suite('a filter callback refusing to serve a request yet', () => {
	const REFUSAL_TEXT = 'Access could not be confirmed. Try again shortly.';

	/** Refuses saving a set and exporting with the unavailable refusal, and permits every other read. */
	const refusingWrites = (context: unknown, details?: { readPath?: unknown }) => {
		if (details?.readPath === 'export' || details?.readPath === 'sets') {
			throw new packageRoot.AccessControlUnavailableError(REFUSAL_TEXT, { retryAfterSeconds: 7 });
		}

		return packageRoot.includeEverything(context);
	};

	const evaluationFailuresIn = (lines: string[]) =>
		lines.filter((line) => line.includes('access_control.evaluation_failed'));

	test('answers saving a set with the unavailable code and its text, no data, nothing stored and no evaluation failure logged', async () => {
		// Given a router whose callback refuses writes for now
		const { engine, router } = await buildRouter({ getServerSideFilter: refusingWrites });

		// When a set is saved
		const { lines, result: response } = await withConsoleCaptured(() => postGraphQL(router, SAVE_SET_MUTATION));

		// Then the one error carries the unavailable code and the callback's text, and nothing reached the engine
		assert.deepEqual(
			response.body.errors.map(({ extensions, message }: { extensions?: { code?: string }; message: string }) => [
				extensions?.code,
				message,
			]),
			[[packageRoot.ACCESS_CONTROL_UNAVAILABLE_CODE, REFUSAL_TEXT]],
		);
		assert.equal(response.body.data?.saveSet ?? null, null);
		assert.deepEqual(engine.storedSets, []);
		assert.deepEqual(evaluationFailuresIn(lines), []);
	});

	test('answers an export 503 with Retry-After and its text, before any search, logging no evaluation failure', async () => {
		// Given the same router
		const { engine, router } = await buildRouter({ getServerSideFilter: refusingWrites });

		// When an export is requested
		const { lines, result: response } = await withConsoleCaptured(() => exportFrom(express().use(router)));

		// Then it is refused for now, with the callback's text and wait, before the engine is asked anything
		assert.equal(response.status, 503);
		assert.equal(response.headers['retry-after'], '7');
		assert.equal(response.text, REFUSAL_TEXT);
		assert.deepEqual(engine.searches, []);
		assert.deepEqual(evaluationFailuresIn(lines), []);
	});

	test('serves the reads it does not refuse', async () => {
		const { router } = await buildRouter({ getServerSideFilter: refusingWrites });

		const response = await postGraphQL(router, HITS_QUERY);

		assert.equal(response.body.errors, undefined);
		assert.equal(response.body.data.donor.hits.total, DOCUMENTS.length);
	});
});

suite("arrangerRouter's onIndexMapping hook", () => {
	test('hands the host a copy of the fetched index mapping, before the router resolves', async () => {
		// Given a hook recording the mapping handed to it, then altering its copy
		const received: unknown[] = [];
		const { router } = await buildRouter({
			onIndexMapping: (mapping: Record<string, unknown>) => {
				received.push(structuredClone(mapping));
				delete mapping.study;
			},
		});

		// When the router is built, Then the hook saw the fetched mapping once
		assert.deepEqual(received, [MAPPING]);

		// And the router still serves the field deleted from the host's copy
		const response = await postGraphQL(router, AGGREGATIONS_QUERY);
		assert.equal(response.body.errors, undefined, JSON.stringify(response.body.errors));
		assert.ok(response.body.data.donor.aggregations.study.buckets.length > 0);
	});

	test("fails the router's construction when the hook throws", async () => {
		// Given a hook refusing the mapping
		const { result: failure } = await withConsoleCaptured(() =>
			arrangerRouter({
				configs: CATALOGUE_CONFIGS,
				esClient: createSearchEngine().client,
				onIndexMapping: () => {
					throw new Error('study is not mapped as a keyword');
				},
			}).then(
				() => undefined,
				(error: unknown) => error,
			),
		);

		// Then construction rejects, carrying the hook's refusal
		assert.equal(
			messageChainOf(failure),
			'Failed to initialize Arranger server <- study is not mapped as a keyword',
		);
	});
});
