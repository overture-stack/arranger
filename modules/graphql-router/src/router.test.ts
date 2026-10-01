import assert from 'node:assert/strict';
import { mock, suite, test } from 'node:test';
import { format } from 'node:util';

import { tableDefaults, tableProperties } from '@overture-stack/arranger-types/configs/constants';
import express, { type Request, type RequestHandler, type Router } from 'express';
import request from 'supertest';

import { restrictingFilter } from '#accessControl/serverSideFilters.fixture.js';
import fallbackCatalogConfigs from '#config/constants.js';
import * as packageRoot from '#index.js';
import type { SearchClient } from '#searchClient/index.js';

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
		// Given a router built with a filter on study, whose facet on study ignores the search query
		const { engine, router } = await buildRouter({ getServerSideFilter: STUDY_A });

		// When both facets are requested
		const response = await postGraphQL(router, AGGREGATIONS_QUERY);

		// Then the study facet went through a global aggregation, and both facets count only permitted documents
		const aggregationSearch = engine.searches.find((search) => search.body?.aggs);
		assert.ok(
			Object.keys(aggregationSearch?.body?.aggs ?? {}).some((name) => name.endsWith(':global')),
			'precondition: the facet on the filtered field is computed outside the search query',
		);
		assert.deepEqual(response.body.data.donor.aggregations.study.buckets, [{ doc_count: 3, key: 'A' }]);
		assert.deepEqual(
			response.body.data.donor.aggregations.donor_id.buckets.map(({ key }: { key: string }) => key),
			PERMITTED_IDS,
		);
	});

	test("a client filter on the filter's own field cannot lift it from that field's facet", async () => {
		// Given the same router, and a client filter asking for study B
		const { router } = await buildRouter({ getServerSideFilter: STUDY_A });
		const filters = { content: [{ content: { fieldName: 'study', value: ['B'] }, op: 'in' }], op: 'and' };

		// When both facets are requested under that filter
		const response = await postGraphQL(router, AGGREGATIONS_QUERY, { filters });

		// Then the study facet still shows only study A, and the other facet shows nothing
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
