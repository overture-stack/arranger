import assert from 'node:assert/strict';
import { mock, suite, test } from 'node:test';
import { format } from 'node:util';

import express from 'express';
import { GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
import request from 'supertest';

import { restrictingFilter } from '#accessControl/serverSideFilters.fixture.js';
import { createEndpoint } from '#graphqlRoutes.js';
import compileFilter from '#mapping/utils/compileFilter.js';
import arrangerRouter from '#router.js';
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
const SECRET_DETAIL = 'token service unreachable at 10.0.0.5';
const ENGINE_FAILURE = 'engine unavailable at 10.0.0.9';
/** An ordinary error that merely talks about filters and access control, which masking by message text would catch. */
const FILTER_WORDED_FAILURE = 'compileFilter: the client filter is not a valid sqon, so access control was not reached';

type GraphQLErrorBody = { extensions?: { exception?: { stacktrace?: string[] } }; message: string };

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
const graphQLErrorsOf = (response: request.Response): { bodyText: string; errors: GraphQLErrorBody[] } => ({
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

/** An `AccessControlError` as another copy of this package raises it: the same name, from a different class. */
class AccessControlErrorFromAnotherCopy extends Error {
	override name = 'AccessControlError';
}

/**
 * A schema whose fields reach compileFilter's own refusals and another copy's refusal, beside fields
 * failing for reasons unrelated to access control.
 */
const accessControlSchema = new GraphQLSchema({
	query: new GraphQLObjectType({
		fields: {
			absentFilter: {
				resolve: () => compileFilter({ clientSideFilter: undefined, serverSideFilter: undefined }),
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
			filterWordedFailure: {
				resolve: () => {
					throw new Error(FILTER_WORDED_FAILURE);
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
}: {
	esClient?: SearchClient;
	getServerSideFilter: unknown;
}) => {
	const router = await withApolloDebugOn(() =>
		withConsoleCaptured(() =>
			arrangerRouter({
				configs: {
					documentType: 'donor',
					enableDebug: true,
					esIndex: 'donor_index',
					network: { localNode: { displayName: 'local node' } },
				},
				esClient,
				getServerSideFilter: getServerSideFilter as never,
			}),
		),
	);

	return express().use(router.result);
};

const postQuery = (app: express.Express, query: string) =>
	withConsoleCaptured(() =>
		request(app)
			.post('/graphql')
			.send({ query })
			.then((response) => response),
	);

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
		const response = await request(await buildApp())
			.post('/graphql')
			.send({ query: '{ helth }' });

		assert.equal(response.status, 400);
		const message: string = response.body?.errors?.[0]?.message ?? '';
		assert.match(message, /Cannot query field/i);
		assert.doesNotMatch(message, /Did you mean/i);
	});

	test('leaves an unrelated validation error message unchanged', async () => {
		const response = await request(await buildApp())
			.post('/graphql')
			.send({ query: '{ health(unknownArg: 1) }' });

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

	test('leaves an error unrelated to access control unchanged, stack included under debug', async () => {
		// Given the same endpoint, whose third field fails for a reason unrelated to access control
		const app = await buildDebugApp();

		// When that field is queried
		const { result: response } = await postQuery(app, '{ engineFailure }');

		// Then its message reaches the client as thrown, with the stack debug mode adds
		const { errors } = graphQLErrorsOf(response);
		assert.equal(errors[0]?.message, ENGINE_FAILURE);
		assert.ok(Array.isArray(errors[0]?.extensions?.exception?.stacktrace));
	});

	test('leaves an ordinary error unchanged even when its message talks about filters and access control', async () => {
		// Given the same endpoint, whose fourth field throws a plain Error worded like an access-control refusal
		const app = await buildDebugApp();

		// When that field is queried
		const { result: response } = await postQuery(app, '{ filterWordedFailure }');

		// Then it is not masked, because masking follows the error's kind and not its wording
		const { errors } = graphQLErrorsOf(response);
		assert.equal(errors[0]?.message, FILTER_WORDED_FAILURE);
		assert.ok(Array.isArray(errors[0]?.extensions?.exception?.stacktrace));
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
				const followUp = await request(app).get('/introspection');

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

	test("leaves a search engine failure's error unchanged, stack included under debug", async () => {
		// Given a router with a working callback over a search engine that fails every search
		const app = await buildRouterApp({
			esClient: stubSearchClient({ searchFailure: new Error(ENGINE_FAILURE) }),
			getServerSideFilter: STUDY_A,
		});

		// When hits are queried
		const { result: response } = await postQuery(app, READ_PATH_QUERIES.hits);

		// Then the engine's message reaches the client as thrown, with the stack debug mode adds
		const { errors } = graphQLErrorsOf(response);
		assert.equal(errors[0]?.message, ENGINE_FAILURE);
		assert.ok(Array.isArray(errors[0]?.extensions?.exception?.stacktrace));
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

const localNodeOf = (response: request.Response): NetworkNodeBody | undefined =>
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

	test("leaves a local node's search engine failure in its errors unchanged", async () => {
		// Given a router with a working callback over a search engine that fails every search
		const app = await buildRouterApp({
			esClient: stubSearchClient({ searchFailure: new Error(ENGINE_FAILURE) }),
			getServerSideFilter: STUDY_A,
		});

		// When network search is queried
		const { result: response } = await postQuery(app, NETWORK_NODES_QUERY);

		// Then the local node reports the engine's own message
		const localNode = localNodeOf(response);
		assert.equal(localNode?.status, 'ERROR', JSON.stringify(response.body));
		assert.ok(
			localNode?.errors.includes(ENGINE_FAILURE),
			`expected the engine's message, got ${JSON.stringify(localNode?.errors)}`,
		);
	});
});
