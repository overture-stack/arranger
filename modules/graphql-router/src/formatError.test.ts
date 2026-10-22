import assert from 'node:assert/strict';
import { mock, suite, test } from 'node:test';
import { format, inspect } from 'node:util';

import express from 'express';
import { GraphQLInt, GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
import type supertest from 'supertest';

import { AccessControlQueryTooLargeError } from '#accessControl/AccessControlError.js';
import includeEverything from '#accessControl/includeEverything.js';
import { restrictingFilter } from '#accessControl/serverSideFilters.fixture.js';
import { createEndpoint } from '#graphqlRoutes.js';
import { withLoopbackServer } from '#loopbackServer.fixture.js';
import compileFilter from '#mapping/utils/compileFilter.js';
import buildQuery from '#middleware/buildQuery/index.js';
import { SCHEMA_ANSWER, serveRemoteNode, withUnreachableRemoteNode } from '#network/remoteNodeStub.fixture.js';
import arrangerRouter from '#router.js';
import {
	CLIENTS,
	ONE_COMBINATION_PAST_THE_LIMIT,
	UNPARSEABLE_DATE_BOUND,
	WHOLE_QUERY_PAST_THE_LIMIT,
} from '#searchClient/clauseLimit.fixture.js';
import type { SearchClient } from '#searchClient/index.js';

const schema = new GraphQLSchema({
	query: new GraphQLObjectType({
		fields: {
			health: {
				resolve: () => 'ok',
				type: GraphQLString,
			},
		},
		name: 'Query',
	}),
});

const DOCUMENTS = [
	{ _id: 'DO_01', _source: { donor_id: 'DO_01', study: 'A' } },
	{ _id: 'DO_02', _source: { donor_id: 'DO_02', study: 'B' } },
];

/** A search engine answering every search with the same documents, or failing every search when given `searchFailure`. */
const stubSearchClient = ({ searchFailure }: { searchFailure?: Error } = {}): SearchClient =>
	({
		cat: { aliases: async () => ({ body: [] }) },
		index: async () => ({ body: { result: 'created' } }),
		indices: {
			getMapping: async ({ index }: { index: string }) => ({
				body: {
					[index]: {
						mappings: { properties: { donor_id: { type: 'keyword' }, study: { type: 'keyword' } } },
					},
				},
			}),
		},
		search: async () => {
			if (searchFailure) {
				throw searchFailure;
			}

			return {
				body: {
					aggregations: {},
					hits: {
						hits: DOCUMENTS.map((document) => ({
							...document,
							_source: { ...document._source },
							sort: [document._id],
						})),
						total: { value: DOCUMENTS.length },
					},
				},
			};
		},
	}) as unknown as SearchClient;

const buildApp = async () => {
	const arrangerRouter = await createEndpoint({
		disablePlayground: true,
		enableDebug: false,
		esClient: stubSearchClient(),
		schema,
	});

	return express().use(arrangerRouter);
};

const MASKED_MESSAGE =
	'The server could not apply its access control because of a problem in its configuration, not in this request.';
const SERVER_PROBLEM_MESSAGE = 'The request failed because of a problem on the server, not in the request.';
const CLAUSE_LIMIT_RULE = 'The filter must compile to no more clauses than the search engine accepts.';
const INVALID_OPERATOR_RULE = 'Each filter node must name an operator SQON defines, such as and, or, not, in or gte.';
const SECRET_DETAIL = 'token service unreachable at 10.0.0.5';
const ENGINE_FAILURE = 'engine unavailable at 10.0.0.9';
/** An ordinary error that merely talks about filters and access control, which masking by message text would catch. */
const FILTER_WORDED_FAILURE = 'compileFilter: the client filter is not a valid sqon, so access control was not reached';

type GraphQLErrorBody = {
	extensions?: { code?: string; exception?: { stacktrace?: string[] } };
	message: string;
	path?: unknown[];
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

/**
 * Builds with Apollo's own debug mode on, which is what adds stack traces to error responses. Apollo
 * decides it from NODE_ENV at construction, so the mode is fixed here rather than left to whatever
 * the test runner happens to set.
 */
const withApolloDebugOn = async <Result>(build: () => Promise<Result>): Promise<Result> => {
	const originalNodeEnvironment = process.env.NODE_ENV;
	process.env.NODE_ENV = 'development';

	try {
		return await build();
	} finally {
		if (originalNodeEnvironment === undefined) {
			delete process.env.NODE_ENV;
		} else {
			process.env.NODE_ENV = originalNodeEnvironment;
		}
	}
};

/** Each error in the response, with the response body as text for asserting nothing leaked anywhere in it. */
const graphQLErrorsOf = (response: supertest.Response): { bodyText: string; errors: GraphQLErrorBody[] } => ({
	bodyText: JSON.stringify(response.body),
	errors: response.body?.errors ?? [],
});

const assertMasked = ({ bodyText, errors }: { bodyText: string; errors: GraphQLErrorBody[] }, leakedDetail: string) => {
	assert.ok(errors.length > 0, `expected an error, got ${bodyText}`);
	errors.forEach((error) => {
		assert.equal(error.message, MASKED_MESSAGE);
		assert.equal(error.extensions?.exception, undefined);
	});
	assert.ok(!bodyText.includes(leakedDetail), `the response carried "${leakedDetail}": ${bodyText}`);
	assert.ok(!bodyText.includes('stacktrace'), `the response carried a stack trace: ${bodyText}`);
};

/** Asserts every error is answered as a problem on the server, carrying none of `detail`. */
const assertServerProblem = (
	{ bodyText, errors }: { bodyText: string; errors: GraphQLErrorBody[] },
	detail: string,
) => {
	assert.ok(errors.length > 0, `expected an error, got ${bodyText}`);
	errors.forEach((error) => {
		assert.equal(error.message, SERVER_PROBLEM_MESSAGE);
		assert.deepEqual(error.extensions, { code: 'INTERNAL_SERVER_ERROR' });
	});
	assert.ok(!bodyText.includes(detail), `the response carried "${detail}": ${bodyText}`);
};

/** An `AccessControlError` as another copy of this package raises it: the same name, from a different class. */
class AccessControlErrorFromAnotherCopy extends Error {
	override name = 'AccessControlError';
}

/**
 * A schema whose fields reach compileFilter's own refusals and another copy's refusal, beside fields
 * failing for reasons unrelated to access control, the router's other answers, and fields that serve.
 */
const accessControlSchema = new GraphQLSchema({
	query: new GraphQLObjectType({
		fields: {
			absentFilter: {
				resolve: () => compileFilter({ clientSideFilter: undefined, serverSideFilter: undefined }),
				type: GraphQLString,
			},
			count: {
				args: { first: { type: GraphQLInt } },
				resolve: (_root, { first }) => String(first),
				type: GraphQLString,
			},
			emptyFilter: {
				resolve: () =>
					compileFilter({ clientSideFilter: undefined, serverSideFilter: { content: [], op: 'and' } }),
				type: GraphQLString,
			},
			engineFailure: {
				resolve: () => {
					throw new Error(ENGINE_FAILURE);
				},
				type: GraphQLString,
			},
			engineReport: {
				resolve: () => {
					throw CLIENTS.Elasticsearch(UNPARSEABLE_DATE_BOUND);
				},
				type: GraphQLString,
			},
			filterWordedFailure: {
				resolve: () => {
					throw new Error(FILTER_WORDED_FAILURE);
				},
				type: GraphQLString,
			},
			health: {
				resolve: () => 'ok',
				type: GraphQLString,
			},
			invalidFilter: {
				resolve: () =>
					buildQuery({
						filters: { content: { fieldName: 'study', value: ['A'] }, op: 'no-such-operator' },
						nestedFieldNames: [],
					}),
				type: GraphQLString,
			},
			queryTooLarge: {
				resolve: () => {
					throw new AccessControlQueryTooLargeError({
						catalogue: 'donor',
						cause: CLIENTS.OpenSearch(WHOLE_QUERY_PAST_THE_LIMIT),
						clauseLimit: 1024,
						readPath: 'hits',
					});
				},
				type: GraphQLString,
			},
			refusalFromAnotherCopy: {
				resolve: () => {
					throw new AccessControlErrorFromAnotherCopy(SECRET_DETAIL);
				},
				type: GraphQLString,
			},
		},
		name: 'Query',
	}),
});

const buildDebugApp = async () => {
	const endpoint = await withApolloDebugOn(() =>
		withConsoleCaptured(() =>
			createEndpoint({
				disablePlayground: true,
				enableDebug: true,
				esClient: stubSearchClient(),
				schema: accessControlSchema,
			}),
		),
	);

	return express().use(endpoint.result);
};

/** The message compileFilter refuses a server-side filter with, for asserting it reached the server log. */
const compileFilterRefusalOf = (serverSideFilter: unknown): string => {
	try {
		compileFilter({ clientSideFilter: undefined, serverSideFilter });
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}

	return assert.fail('compileFilter accepted the filter');
};

/** An app serving a router built with `getServerSideFilter`, network search on, and every kind of debug on. */
const buildRouterApp = async ({
	esClient = stubSearchClient(),
	getServerSideFilter,
	remoteNodes = [],
}: {
	esClient?: SearchClient;
	getServerSideFilter: unknown;
	remoteNodes?: { displayName: string; documentType: string; graphqlUrl: string }[];
}) => {
	const router = await withApolloDebugOn(() =>
		withConsoleCaptured(() =>
			arrangerRouter({
				configs: {
					documentType: 'donor',
					enableDebug: true,
					esIndex: 'donor_index',
					network: { localNode: { displayName: 'local node' }, remoteNodes },
				},
				esClient,
				getServerSideFilter: getServerSideFilter as never,
			}),
		),
	);

	return express().use(router.result);
};

const postQuery = (app: express.Express, query: string) =>
	withConsoleCaptured(() => withLoopbackServer(app, (request) => request.post('/graphql').send({ query })));

const READ_PATH_QUERIES = {
	aggregations: '{ donor { aggregations { study { buckets { key doc_count } } } } }',
	hits: '{ donor { hits { total edges { node { donor_id } } } } }',
	'network search': '{ network { nodes { name hits } aggregations { study { buckets { key doc_count } } } } }',
	'saved sets': 'mutation { saveSet(type: donor, sqon: {}, path: "donor_id") { ids size } }',
} satisfies Record<string, string>;

const STUDY_A = restrictingFilter({ fieldName: 'study', values: ['A'] });

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

suite('formatError', () => {
	test('strips "Did you mean" field-name suggestions from a misspelled-field error', async () => {
		const response = await withLoopbackServer(await buildApp(), (request) =>
			request.post('/graphql').send({ query: '{ helth }' }),
		);

		assert.equal(response.status, 400);
		const message: string = response.body?.errors?.[0]?.message ?? '';
		assert.match(message, /Cannot query field/i);
		assert.doesNotMatch(message, /Did you mean/i);
	});

	test('leaves an unrelated validation error message unchanged', async () => {
		const response = await withLoopbackServer(await buildApp(), (request) =>
			request.post('/graphql').send({ query: '{ health(unknownArg: 1) }' }),
		);

		assert.equal(response.status, 400);
		const message: string = response.body?.errors?.[0]?.message ?? '';
		assert.match(message, /unknownArg/i);
	});
});

suite("formatError masks compileFilter's refusals", () => {
	test('answers a refused absent filter with fixed text and no stack, even with debug on', async () => {
		// Given an endpoint built with debug on, whose field compileFilter refuses for having no filter
		const app = await buildDebugApp();

		// When the field is queried
		const { result: response } = await postQuery(app, '{ absentFilter }');

		// Then the client sees only the fixed text
		assertMasked(graphQLErrorsOf(response), 'compileFilter');
	});

	test('answers a refused empty combination with fixed text and no stack, even with debug on', async () => {
		// Given the same endpoint, whose other field compileFilter refuses for restricting nothing
		const app = await buildDebugApp();

		// When the field is queried
		const { result: response } = await postQuery(app, '{ emptyFilter }');

		// Then the client sees only the fixed text
		assertMasked(graphQLErrorsOf(response), 'compileFilter');
	});

	test('answers an AccessControlError raised by another copy of the package with fixed text, as network search does', async () => {
		// Given the same endpoint, whose field throws an error named AccessControlError from a class of its own
		const app = await buildDebugApp();

		// When the field is queried
		const { result: response } = await postQuery(app, '{ refusalFromAnotherCopy }');

		// Then the client sees only the fixed text, since both paths recognize the error by its name
		assertMasked(graphQLErrorsOf(response), SECRET_DETAIL);
	});

	test("logs the refusal's full message on the server", async () => {
		// Given the same endpoint, and the message compileFilter refuses an absent filter with
		const app = await buildDebugApp();
		const refusalMessage = compileFilterRefusalOf(undefined);

		// When the field is queried
		const { lines } = await postQuery(app, '{ absentFilter }');

		// Then the server log carries that message
		assert.ok(
			lines.some((line) => line.includes(refusalMessage)),
			`expected the log to carry "${refusalMessage}", got ${JSON.stringify(lines)}`,
		);
	});

	test('answers an error unrelated to access control with fixed text naming the server, logging its message', async () => {
		// Given the same endpoint, whose third field fails for a reason unrelated to access control
		const app = await buildDebugApp();

		// When that field is queried
		const { lines, result: response } = await postQuery(app, '{ engineFailure }');

		// Then the client is told the problem is on the server, and the server log has the message
		assertServerProblem(graphQLErrorsOf(response), ENGINE_FAILURE);
		assert.ok(
			lines.some((line) => line.includes('graphql.failed') && line.includes(ENGINE_FAILURE)),
			`expected a graphql.failed line carrying the message, got ${JSON.stringify(lines)}`,
		);
	});

	test('answers an ordinary error worded like an access-control refusal as a problem on the server, by its kind', async () => {
		// Given the same endpoint, whose fourth field throws a plain Error worded like an access-control refusal
		const app = await buildDebugApp();

		// When that field is queried
		const { result: response } = await postQuery(app, '{ filterWordedFailure }');

		// Then it is answered as a server problem, since the answer follows the error's kind and not its wording
		assertServerProblem(graphQLErrorsOf(response), FILTER_WORDED_FAILURE);
	});
});

suite("formatError masks filter callback failures on the router's read paths", () => {
	for (const [readPath, query] of Object.entries(READ_PATH_QUERIES)) {
		test(`masks a callback that throws, on ${readPath}, and logs what it threw`, async () => {
			// Given a router whose filter callback throws with detail a client must not see
			const app = await buildRouterApp({
				getServerSideFilter: () => {
					throw new Error(SECRET_DETAIL);
				},
			});

			// When the read path is queried
			const { lines, result: response } = await postQuery(app, query);

			// Then the client sees only the fixed text, and the server log has the detail
			assertMasked(graphQLErrorsOf(response), SECRET_DETAIL);
			assert.ok(
				lines.some((line) => line.includes(SECRET_DETAIL)),
				`expected the log to carry the thrown detail, got ${JSON.stringify(lines)}`,
			);
		});

		test(`refuses a filter holding an empty combination, on ${readPath}, and logs where it sits`, async () => {
			// Given a router whose callback returns an empty or beside a clause
			const app = await buildRouterApp({
				getServerSideFilter: () => ({
					content: [
						{ content: { fieldName: 'study', value: ['A'] }, op: 'in' },
						{ content: [], op: 'or' },
					],
					op: 'and',
				}),
			});

			// When the read path is queried
			const { lines, result: response } = await postQuery(app, query);

			// Then the client sees only the fixed text, and the server log says where the empty combination is
			assertMasked(graphQLErrorsOf(response), 'content[1]');
			assert.ok(
				lines.some((line) => line.includes("empty 'or' combination at content[1]")),
				`expected the log to place the empty combination, got ${JSON.stringify(lines)}`,
			);
		});

		test(`masks a callback that returns a promise, on ${readPath}`, async () => {
			// Given a router whose filter callback is not async but returns a promise of a valid filter
			const app = await buildRouterApp({
				getServerSideFilter: (context: unknown) => Promise.resolve(STUDY_A(context)),
			});

			// When the read path is queried
			const { result: response } = await postQuery(app, query);

			// Then the promise is refused rather than read as a filter, and the client sees the fixed text
			assertMasked(graphQLErrorsOf(response), 'compileFilter');
		});

		test(`answers ${readPath} with the fixed text when a callback's promise rejects, and the router answers the next request`, async () => {
			// Given a router whose callback returns a promise that rejects, and a record of process error events
			const app = await buildRouterApp({ getServerSideFilter: () => Promise.reject(new Error(SECRET_DETAIL)) });
			const watcher = recordProcessErrors();

			try {
				// When the read path is queried, and the router is asked something else afterwards
				const { result: response } = await postQuery(app, query);
				await afterPendingRejections();
				const followUp = await withLoopbackServer(app, (request) => request.get('/introspection'));

				// Then the query was masked, the process recorded no error event, and the router answers the next request
				assertMasked(graphQLErrorsOf(response), SECRET_DETAIL);
				assert.deepEqual(watcher.faults, []);
				assert.equal(followUp.status, 200);
			} finally {
				watcher.stop();
			}
		});
	}

	test('masks a callback returning nothing or an empty combination, which compileFilter refuses', async () => {
		// Given routers whose callbacks return undefined and an empty combination
		const apps = await Promise.all([
			buildRouterApp({ getServerSideFilter: () => undefined }),
			buildRouterApp({ getServerSideFilter: () => ({ content: [], op: 'and' }) }),
		]);

		// When hits are queried on each
		const responses = await Promise.all(apps.map((app) => postQuery(app, READ_PATH_QUERIES.hits)));

		// Then each answers with the fixed text
		responses.forEach(({ result: response }) => assertMasked(graphQLErrorsOf(response), 'compileFilter'));
	});

	test('answers a search engine failure with fixed text naming the server, logging its detail', async () => {
		// Given a router with a working callback over a search engine that fails every search
		const app = await buildRouterApp({
			esClient: stubSearchClient({ searchFailure: new Error(ENGINE_FAILURE) }),
			getServerSideFilter: STUDY_A,
		});

		// When hits are queried
		const { lines, result: response } = await postQuery(app, READ_PATH_QUERIES.hits);

		// Then the client is told the problem is on the server, and the server log has the engine's message
		assertServerProblem(graphQLErrorsOf(response), ENGINE_FAILURE);
		assert.ok(
			lines.some((line) => line.includes('graphql.failed') && line.includes(ENGINE_FAILURE)),
			`expected a graphql.failed line carrying the detail, got ${JSON.stringify(lines)}`,
		);
	});
});

type NetworkNodeBody = { errors: string; name: string; status: string };

const NETWORK_NODES_QUERY =
	'{ network { nodes { errors name status } aggregations { study { buckets { key doc_count } } } } }';

/**
 * A callback that permits study A the first time it is evaluated for a request's context, and fails as
 * `failLater` does every time after, so network search resolves its own filter and the local node's do not.
 */
const permittingOnlyTheFirstEvaluation = (failLater: () => unknown): ((context: unknown) => unknown) => {
	const evaluatedContexts = new WeakSet<object>();

	return (context: unknown) => {
		const requestContext = context as object;

		if (evaluatedContexts.has(requestContext)) {
			return failLater();
		}

		evaluatedContexts.add(requestContext);
		return STUDY_A(context);
	};
};

const localNodeOf = (response: supertest.Response): NetworkNodeBody | undefined =>
	(response.body?.data?.network?.nodes as NetworkNodeBody[] | undefined)?.find(({ name }) => name === 'local node');

suite("network search reports a local node's access-control failure with fixed text", () => {
	for (const [description, failLater] of [
		[
			'throws',
			() => {
				throw new Error(SECRET_DETAIL);
			},
		],
		['returns nothing, which compileFilter refuses', () => undefined],
	] as const) {
		test(`answers the local node's errors with fixed text when its callback ${description}`, async () => {
			// Given a router whose callback resolves network search's own filter, then fails as named for the local node
			const app = await buildRouterApp({ getServerSideFilter: permittingOnlyTheFirstEvaluation(failLater) });

			// When network search is queried
			const { result: response } = await postQuery(app, NETWORK_NODES_QUERY);

			// Then the query succeeds, and the local node reports each failure only as the fixed text
			const { bodyText } = graphQLErrorsOf(response);
			const localNode = localNodeOf(response);
			assert.equal(response.body?.errors, undefined, bodyText);
			assert.equal(localNode?.status, 'ERROR', `${response.status} ${response.text}`);
			assert.ok(
				localNode?.errors.split(' | ').every((message) => message === MASKED_MESSAGE),
				`expected only the fixed text, got ${JSON.stringify(localNode?.errors)}`,
			);
			assert.ok(!bodyText.includes(SECRET_DETAIL), `the response carried "${SECRET_DETAIL}": ${bodyText}`);
			assert.ok(!bodyText.includes('getServerSideFilter'), `the response named the callback: ${bodyText}`);
		});
	}

	test('logs the detail on the server under the access-control evaluation event', async () => {
		// Given a router whose callback throws with detail a client must not see, once network search has its filter
		const app = await buildRouterApp({
			getServerSideFilter: permittingOnlyTheFirstEvaluation(() => {
				throw new Error(SECRET_DETAIL);
			}),
		});

		// When network search is queried
		const { lines } = await postQuery(app, NETWORK_NODES_QUERY);

		// Then a line under the event carries the thrown detail
		assert.ok(
			lines.some((line) => line.includes('access_control.evaluation_failed') && line.includes(SECRET_DETAIL)),
			`expected an access_control.evaluation_failed line carrying the detail, got ${JSON.stringify(lines)}`,
		);
	});
});

type ConsoleCall = { args: unknown[]; method: (typeof CONSOLE_METHODS)[number] };

/** Runs `work` with console output captured, returning each call's method and arguments. */
const withConsoleCalls = async <Result>(
	work: () => Promise<Result>,
): Promise<{ calls: ConsoleCall[]; result: Result }> => {
	const calls: ConsoleCall[] = [];
	const mocks = CONSOLE_METHODS.map((method) =>
		mock.method(console, method, (...args: unknown[]) => {
			calls.push({ args, method });
		}),
	);

	try {
		return { calls, result: await work() };
	} finally {
		mocks.forEach((mocked) => mocked.mock.restore());
	}
};

const QUERY_TOO_LARGE_MESSAGE =
	'The search engine refused this request to catalogue "donor" as larger than it accepts once the catalogue\'s access filter was applied.';

/** Network search's nodes with their hits, so the local node's hits and aggregations both run. */
const NETWORK_NODES_AND_HITS_QUERY =
	'{ network { nodes { errors hits name status } aggregations { study { buckets { key doc_count } } } } }';

const nodeNamed = (response: supertest.Response, name: string): NetworkNodeBody | undefined =>
	(response.body?.data?.network?.nodes as NetworkNodeBody[] | undefined)?.find((node) => node.name === name);

/** Asserts the node reports `text` once for each read it failed, and the response carries none of `details`. */
const assertNodeAnswered = (
	response: supertest.Response,
	{ details, name, reads, text }: { details: string[]; name: string; reads: number; text: string },
) => {
	const node = nodeNamed(response, name);
	const bodyText = JSON.stringify(response.body);

	assert.equal(response.body?.errors, undefined, bodyText);
	assert.equal(node?.status, 'ERROR', bodyText);
	assert.deepEqual(node?.errors.split(' | '), Array(reads).fill(text), bodyText);
	details.forEach((detail) => assert.ok(!bodyText.includes(detail), `the response carried "${detail}": ${bodyText}`));
};

suite("network search answers each node's failure as the GraphQL endpoint answers it", () => {
	test("answers a local node's search engine failure with fixed text naming the server, logging it with the node", async () => {
		// Given a router with a working callback over a search engine that fails every search
		const app = await buildRouterApp({
			esClient: stubSearchClient({ searchFailure: new Error(ENGINE_FAILURE) }),
			getServerSideFilter: STUDY_A,
		});

		// When network search is queried for hits and aggregations
		const { lines, result: response } = await postQuery(app, NETWORK_NODES_AND_HITS_QUERY);

		// Then the local node reports each failed read as a problem on the server, and the log names the node
		assertNodeAnswered(response, {
			details: [ENGINE_FAILURE],
			name: 'local node',
			reads: 2,
			text: SERVER_PROBLEM_MESSAGE,
		});
		assert.ok(
			lines.some(
				(line) =>
					line.includes('network.node_failed') &&
					line.includes('local node') &&
					line.includes(ENGINE_FAILURE),
			),
			`expected a network.node_failed line naming the node and carrying the detail, got ${JSON.stringify(lines)}`,
		);
	});

	test("answers a local node's read past the clause limit under a restricting filter with the refusal's text, logging it with the node", async () => {
		// Given a router with a restricting callback over an engine refusing every search past its clause limit
		const app = await buildRouterApp({
			esClient: stubSearchClient({ searchFailure: CLIENTS.OpenSearch(WHOLE_QUERY_PAST_THE_LIMIT) }),
			getServerSideFilter: STUDY_A,
		});

		// When network search is queried for hits and aggregations
		const { calls, result: response } = await withConsoleCalls(() =>
			withLoopbackServer(app, (request) =>
				request.post('/graphql').send({ query: NETWORK_NODES_AND_HITS_QUERY }),
			),
		);

		// Then the local node reports the refusal's text for each read, logged with the catalogue, read path, limit and node
		assertNodeAnswered(response, {
			details: ['maxClauseCount'],
			name: 'local node',
			reads: 2,
			text: QUERY_TOO_LARGE_MESSAGE,
		});
		assert.deepEqual(
			calls
				.filter(({ args: [event] }) => event === 'access_control.query_too_large')
				.map(({ args, method }) => [method, ...args]),
			['hits', 'aggregations'].map((readPath) => [
				'error',
				'access_control.query_too_large',
				{ catalogue: 'donor', clauseLimit: 1024, node: 'local node', readPath },
			]),
		);
	});

	test('answers a local node given a client filter breaking a rule of SQON with the rule it broke', async () => {
		// Given a router with a restricting callback
		const app = await buildRouterApp({ getServerSideFilter: STUDY_A });

		// When network search is queried with a filter pivoting on a field that is not nested
		const { result: response } = await withConsoleCaptured(() =>
			withLoopbackServer(app, (request) =>
				request.post('/graphql').send({
					query: `query ($filters: JSON) { network(filters: $filters) { nodes { errors hits name status } aggregations { study { buckets { key doc_count } } } } }`,
					variables: {
						filters: {
							content: [{ content: { fieldName: 'study', value: ['A'] }, op: 'in' }],
							op: 'and',
							pivot: 'study',
						},
					},
				}),
			),
		);

		// Then the local node reports the rule for each read
		assertNodeAnswered(response, {
			details: [],
			name: 'local node',
			reads: 2,
			text: "A filter's pivot must name a nested field of this catalogue; it requires the filter's conditions to hold for the same nested object.",
		});
	});

	test("logs a local node's client filter breaking a rule of SQON at info, as network.invalid_request", async () => {
		// Given a router with a restricting callback
		const app = await buildRouterApp({ getServerSideFilter: STUDY_A });

		// When network search is queried with a filter pivoting on a field that is not nested
		const { calls } = await withConsoleCalls(() =>
			withLoopbackServer(app, (request) =>
				request.post('/graphql').send({
					query: `query ($filters: JSON) { network(filters: $filters) { nodes { errors hits name status } aggregations { study { buckets { key doc_count } } } } }`,
					variables: {
						filters: {
							content: [{ content: { fieldName: 'study', value: ['A'] }, op: 'in' }],
							op: 'and',
							pivot: 'study',
						},
					},
				}),
			),
		);

		// Then each of its logs is at info, a client's ordinary mistake
		const levels = calls.filter(({ args }) => args[0] === 'network.invalid_request').map(({ method }) => method);
		assert.ok(levels.length > 0, JSON.stringify(calls));
		assert.deepEqual([...new Set(levels)], ['info']);
	});

	test('answers a remote node nothing answered at startup as unreachable, never naming its URL', async () => {
		// Given a router with a remote node at a URL nothing answers at
		await withUnreachableRemoteNode(async (url) => {
			const app = await buildRouterApp({
				getServerSideFilter: STUDY_A,
				remoteNodes: [{ displayName: 'remote node', documentType: 'donor', graphqlUrl: url }],
			});

			// When network search is queried
			const { result: response } = await postQuery(app, NETWORK_NODES_AND_HITS_QUERY);

			// Then the remote node reports that it could not be reached
			assertNodeAnswered(response, {
				details: [url, '127.0.0.1'],
				name: 'remote node',
				reads: 1,
				text: 'This node could not be reached.',
			});
		});
	});

	test('answers a remote node answering the query with errors as answering with errors, never quoting the node', async () => {
		// Given a router with a remote node answering its schema at startup, then every query with an error of its own
		const remoteDetail = 'index [donor_internal_7] is closed';
		const remote = await serveRemoteNode((query, response) => {
			if (query.includes('__type(')) {
				response.json(SCHEMA_ANSWER);
			} else {
				response.status(400).json({ errors: [{ message: remoteDetail }] });
			}
		});

		try {
			const app = await buildRouterApp({
				getServerSideFilter: STUDY_A,
				remoteNodes: [{ displayName: 'remote node', documentType: 'donor', graphqlUrl: remote.url }],
			});

			// When network search is queried
			const { lines, result: response } = await postQuery(app, NETWORK_NODES_AND_HITS_QUERY);

			// Then the remote node reports that it answered with errors, and only the log carries its message and URL
			assertNodeAnswered(response, {
				details: [remoteDetail, remote.url],
				name: 'remote node',
				reads: 1,
				text: 'This node answered the request with errors.',
			});
			assert.ok(
				lines.some((line) => line.includes(remoteDetail) && line.includes(remote.url)),
				JSON.stringify(lines),
			);
		} finally {
			await remote.close();
		}
	});
});

const ANSWER_MEMBERS = ['extensions', 'locations', 'message', 'path'];

/** Asserts each error holds no member beyond message, locations, path and extensions, and extensions only code. */
const assertOnlyAnswerMembers = ({ bodyText, errors }: { bodyText: string; errors: GraphQLErrorBody[] }) => {
	assert.ok(errors.length > 0, `expected an error, got ${bodyText}`);
	errors.forEach((error) => {
		assert.deepEqual(
			Object.keys(error).filter((member) => !ANSWER_MEMBERS.includes(member)),
			[],
			JSON.stringify(error),
		);
		assert.deepEqual(Object.keys(error.extensions ?? {}), ['code'], JSON.stringify(error));
		assert.equal(typeof error.extensions?.code, 'string', JSON.stringify(error));
	});
};

/** The body of each request the endpoint answers with an error, one per kind of answer. */
const REQUESTS_ANSWERED_WITH_AN_ERROR: [string, unknown][] = [
	['a syntax error', { query: '{ health' }],
	['a validation error', { query: '{ helth }' }],
	[
		'a variable of the wrong type',
		{ query: 'query ($first: Int) { count(first: $first) }', variables: { first: 'many' } },
	],
	['batched operations the endpoint refuses', [{ query: '{ health }' }, { query: '{ health }' }]],
	['a filter breaking a rule of SQON', { query: '{ invalidFilter }' }],
	["a search engine's refusal", { query: '{ engineReport }' }],
	['an unexpected error', { query: '{ engineFailure }' }],
	['an access-control failure', { query: '{ absentFilter }' }],
	["a read the engine refused once the catalogue's access filter was applied", { query: '{ queryTooLarge }' }],
];

suite('a GraphQL error carries only its message, locations, path and code', () => {
	for (const [description, body] of REQUESTS_ANSWERED_WITH_AN_ERROR) {
		test(`answers ${description} with no other member, even with debug on`, async () => {
			// Given an endpoint built with Apollo's debug mode on
			const app = await buildDebugApp();

			// When the request is sent
			const { result: response } = await withConsoleCaptured(() =>
				withLoopbackServer(app, (request) => request.post('/graphql').send(body as object)),
			);

			// Then each error holds only the four members, and extensions only its code
			assertOnlyAnswerMembers(graphQLErrorsOf(response));
		});
	}
});

suite("a request's own mistake keeps its message", () => {
	test('answers a syntax error with its own message and code', async () => {
		const { result: response } = await postQuery(await buildDebugApp(), '{ health');

		const [error] = graphQLErrorsOf(response).errors;
		assert.match(error?.message ?? '', /^Syntax Error: Expected Name, found <EOF>\.$/);
		assert.deepEqual(error?.extensions, { code: 'GRAPHQL_PARSE_FAILED' });
	});

	test('answers a variable of the wrong type with its own message and code', async () => {
		const app = await buildDebugApp();
		const { result: response } = await withConsoleCaptured(() =>
			withLoopbackServer(app, (request) =>
				request
					.post('/graphql')
					.send({ query: 'query ($first: Int) { count(first: $first) }', variables: { first: 'many' } }),
			),
		);

		const [error] = graphQLErrorsOf(response).errors;
		assert.match(error?.message ?? '', /^Variable "\$first" got invalid value "many"; Int cannot represent/);
		assert.deepEqual(error?.extensions, { code: 'BAD_USER_INPUT' });
	});

	test("logs a request's own mistake at info, as graphql.invalid_request", async () => {
		const app = await buildDebugApp();
		const { calls } = await withConsoleCalls(() =>
			withLoopbackServer(app, (request) => request.post('/graphql').send({ query: '{ health' })),
		);

		assert.deepEqual(
			calls.filter(({ args }) => args[0] === 'graphql.invalid_request').map(({ method }) => method),
			['info'],
		);
	});

	test('answers batched operations the endpoint refuses with the rule, not as a problem on the server', async () => {
		const app = await buildDebugApp();
		const { result: response } = await withConsoleCaptured(() =>
			withLoopbackServer(app, (request) =>
				request.post('/graphql').send([{ query: '{ health }' }, { query: '{ health }' }]),
			),
		);

		assert.equal(response.status, 400);
		assert.deepEqual(
			graphQLErrorsOf(response).errors.map(({ message }) => message),
			['Operation batching disabled.'],
		);
	});

	test('answers a filter breaking a rule of SQON with the rule it broke and the BAD_USER_INPUT code', async () => {
		// Given an endpoint whose field compiles a filter naming no operator SQON defines
		const app = await buildDebugApp();

		// When that field is queried
		const { result: response } = await postQuery(app, '{ invalidFilter }');

		// Then the client is told the rule
		const { errors } = graphQLErrorsOf(response);
		assert.deepEqual(
			errors.map(({ extensions, message, path }) => [extensions?.code, message, path]),
			[['BAD_USER_INPUT', INVALID_OPERATOR_RULE, ['invalidFilter']]],
		);
	});

	test("answers a client filter breaking a rule of SQON on a router's read path with the rule it broke", async () => {
		// Given a router with a restricting callback
		const app = await buildRouterApp({ getServerSideFilter: STUDY_A });

		// When hits are queried with a client filter naming no operator SQON defines
		const { result: response } = await withConsoleCaptured(() =>
			withLoopbackServer(app, (request) =>
				request.post('/graphql').send({
					query: 'query ($filters: JSON) { donor { hits(filters: $filters) { total } } }',
					variables: { filters: { content: { fieldName: 'study', value: ['A'] }, op: 'no-such-operator' } },
				}),
			),
		);

		// Then the client is told the rule, as its own mistake
		assert.deepEqual(
			graphQLErrorsOf(response).errors.map(({ extensions, message }) => [extensions?.code, message]),
			[['BAD_USER_INPUT', INVALID_OPERATOR_RULE]],
		);
	});

	test("answers network search given a filter that is not a SQON with the rule, as the request's own mistake", async () => {
		// Given a router serving network search
		const app = await buildRouterApp({ getServerSideFilter: STUDY_A });

		// When network search is queried with a filter that is no SQON node
		const { lines, result: response } = await withConsoleCaptured(() =>
			withLoopbackServer(app, (request) =>
				request.post('/graphql').send({
					query: 'query ($filters: JSON) { network(filters: $filters) { nodes { name } } }',
					variables: { filters: { content: { fieldName: 'study', value: ['A'] }, op: 'no-such-operator' } },
				}),
			),
		);

		// Then the client is told the rule, as its own mistake, and the log carries what the SQON check found
		assert.deepEqual(
			graphQLErrorsOf(response).errors.map(({ extensions, message }) => [extensions?.code, message]),
			[['BAD_USER_INPUT', 'The filter must be a valid SQON.']],
		);
		assert.ok(
			lines.some((line) => line.includes('graphql.invalid_request') && line.includes('invalid_union')),
			JSON.stringify(lines),
		);
	});
});

suite("a search engine's failure is answered as a problem on the server", () => {
	test("answers the engine's own report with fixed text naming the server, and logs the report", async () => {
		// Given an endpoint whose field fails with the engine's report of a date it could not parse
		const app = await buildDebugApp();

		// When that field is queried
		const { lines, result: response } = await postQuery(app, '{ engineReport }');

		// Then the client is told the problem is on the server, and the server log carries the report
		assertServerProblem(graphQLErrorsOf(response), 'not-a-date');
		assert.ok(
			lines.some((line) => line.includes('graphql.failed') && line.includes('parse_exception')),
			`expected a graphql.failed line carrying the report, got ${JSON.stringify(lines)}`,
		);
	});

	test('answers the same fixed text whatever the failure says', async () => {
		// Given two fields failing for different reasons
		const app = await buildDebugApp();

		// When each is queried
		const answers = await Promise.all(
			['{ engineFailure }', '{ engineReport }', '{ filterWordedFailure }'].map(async (query) => {
				const { result: response } = await postQuery(app, query);
				return graphQLErrorsOf(response).errors.map(({ message }) => message);
			}),
		);

		// Then each is answered with the one fixed text
		assert.deepEqual(answers, [[SERVER_PROBLEM_MESSAGE], [SERVER_PROBLEM_MESSAGE], [SERVER_PROBLEM_MESSAGE]]);
	});
});

const CLAUSE_LIMIT_REFUSALS = {
	'one combination past the limit, as Elasticsearch refuses it':
		CLIENTS.Elasticsearch(ONE_COMBINATION_PAST_THE_LIMIT),
	"OpenSearch's count across the whole query": CLIENTS.OpenSearch(WHOLE_QUERY_PAST_THE_LIMIT),
};

const READ_PATHS_SEARCHING_THE_CATALOGUE = [
	['hits', READ_PATH_QUERIES.hits, ['donor', 'hits']],
	['aggregations', READ_PATH_QUERIES.aggregations, ['donor', 'aggregations']],
	['sets', READ_PATH_QUERIES['saved sets'], ['saveSet']],
] as const;

suite("the search engine's refusal of a read past its clause limit, on the GraphQL endpoint", () => {
	for (const [refusalDescription, refusal] of Object.entries(CLAUSE_LIMIT_REFUSALS)) {
		for (const [readPath, query, path] of READ_PATHS_SEARCHING_THE_CATALOGUE) {
			test(`answers ${readPath} under a restricting filter with the access-control refusal naming the catalogue, for ${refusalDescription}`, async () => {
				// Given a router with a restricting callback over an engine refusing every search past its clause limit
				const app = await buildRouterApp({
					esClient: stubSearchClient({ searchFailure: refusal }),
					getServerSideFilter: STUDY_A,
				});

				// When the read path is queried
				const { calls, result: response } = await withConsoleCalls(() =>
					withLoopbackServer(app, (request) => request.post('/graphql').send({ query })),
				);

				// Then the client is given the refusal's code and fixed text, and the server log names the
				// catalogue, the read path and the limit
				const { errors } = graphQLErrorsOf(response);
				assert.deepEqual(
					errors.map(({ extensions, message, path: errorPath }) => [extensions?.code, message, errorPath]),
					[['ACCESS_CONTROL_QUERY_TOO_LARGE', QUERY_TOO_LARGE_MESSAGE, path]],
				);
				assert.deepEqual(
					calls
						.filter(({ args: [event] }) => event === 'access_control.query_too_large')
						.map(({ args, method }) => [method, ...args]),
					[
						[
							'error',
							'access_control.query_too_large',
							{ catalogue: 'donor', clauseLimit: 1024, path, readPath },
						],
					],
				);
			});
		}
	}

	for (const [description, getServerSideFilter] of [
		['given no filter callback', undefined],
		['whose callback returns includeEverything for the request', includeEverything],
	] as const) {
		test(`answers hits on a router ${description} as the request's own mistake, stating the rule`, async () => {
			// Given a router restricting no record over an engine refusing every search past its clause limit
			const app = await buildRouterApp({
				esClient: stubSearchClient({
					searchFailure: CLAUSE_LIMIT_REFUSALS["OpenSearch's count across the whole query"],
				}),
				getServerSideFilter,
			});

			// When hits are queried
			const { lines, result: response } = await postQuery(app, READ_PATH_QUERIES.hits);

			// Then the client is told the rule its filter broke, and nothing is logged as access control
			assert.deepEqual(
				graphQLErrorsOf(response).errors.map(({ extensions, message }) => [extensions?.code, message]),
				[['BAD_USER_INPUT', CLAUSE_LIMIT_RULE]],
			);
			assert.ok(!lines.some((line) => line.includes('access_control.query_too_large')), inspect(lines));
		});
	}
});
