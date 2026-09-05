import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { CLIENT_CAPABILITIES_META_KEY, type McpServer, type ServerContext } from '@modelcontextprotocol/server';

import { type ArrangerClient } from '#arranger/client.js';
import { registerExecuteQueryTool } from '#mcp/executeQueryTool.js';
import { createConfirmationCodec, type ConfirmationState } from '#mcp/requestState.js';
import { type ArrangerMcpConfig } from '#utils/config.js';

/** Fixed HMAC key so the confirmation codec is deterministic and does not warn about a per-process one. */
const TEST_SIGNING_KEY = 'arranger-mcp-test-request-state-signing-key';

const config: ArrangerMcpConfig = {
	arrangerBaseUrl: 'https://arranger.test',
	catalogues: ['participants'],
	requestTimeoutMs: 10_000,
	mcp: {
		host: '0.0.0.0',
		port: 3100,
		path: '/mcp',
		allowedHosts: ['arranger-mcp'],
		allowedOrigins: [],
		requestStateSecret: TEST_SIGNING_KEY,
		maxBodyBytes: 102_400,
	},
};

// One codec for the whole suite, as `startServer` builds one for the whole process: a codec built
// per round would mint under one key and verify under another, and nothing would ever confirm.
const requestStateCodec = createConfirmationCodec(config);

const serverIntrospection = {
	catalogCount: 1,
	catalogs: {
		participants: {
			documentType: 'participant',
			paths: { fields: '/fields', graphql: '/graphql', introspection: '/introspection/participants' },
		},
	},
	mode: 'single',
	sqonSchemaPath: '/introspection/sqon',
};

const catalogueIntrospection = {
	catalogId: 'participants',
	documentType: 'participant',
	generatedAt: '2026-01-01T00:00:00.000Z',
	meta: { authFiltered: false },
	operators: { keyword: ['in', 'not-in', 'some-not-in', 'all', 'filter'] },
	fields: { study: { displayName: 'Study', isArray: false, type: 'keyword' } },
};

const EMPTY_ROOT_SQON = { op: 'and', content: [] };

type ToolResult = {
	content?: { type: string; text: string }[];
	structuredContent?: Record<string, unknown>;
	isError?: boolean;
	/** Present only on the `input_required` return, which is not a `CallToolResult`. */
	resultType?: string;
	inputRequests?: Record<string, { method: string; params: { message: string } }>;
	/** The sealed confirmation state the client echoes back on the next round. */
	requestState?: string;
};

/**
 * Counts the Arranger calls a run makes, so a test can assert that a refusal costs none. `executeQuery`
 * answers with whatever root field the built query selected, rather than a hardcoded name, so the
 * stub does not have to reproduce the document-type sanitization.
 */
const createStubClient = () => {
	const calls = { introspection: 0, executed: 0 };
	const client = {
		getServerIntrospection: () => {
			calls.introspection += 1;
			return Promise.resolve(serverIntrospection);
		},
		getCatalogueIntrospection: () => {
			calls.introspection += 1;
			return Promise.resolve(catalogueIntrospection);
		},
		getSqonIntrospection: () => Promise.reject(new Error('execute_query should not call getSqonIntrospection')),
		executeQuery: (_endpoint: string, request: { rootFieldName: string }) => {
			calls.executed += 1;
			return Promise.resolve({ data: { [request.rootFieldName]: { hits: { total: 1, edges: [] } } } });
		},
	} as unknown as ArrangerClient;
	return { client, calls };
};

/** Captures the handler `registerExecuteQueryTool` registers, so it can be driven directly. */
const captureHandler = (client: ArrangerClient) => {
	let handler: ((args: Record<string, unknown>, ctx: ServerContext) => Promise<ToolResult>) | undefined;
	const server = {
		registerTool: (_name: string, _toolConfig: unknown, registered: unknown) => {
			handler = registered as typeof handler;
		},
	};

	registerExecuteQueryTool(server as unknown as McpServer, { client, config, requestStateCodec });

	if (!handler) {
		throw new Error('registerExecuteQueryTool registered no handler');
	}
	return handler;
};

type ContextOptions = {
	elicitation?: boolean;
	inputResponses?: Record<string, unknown>;
	requestState?: ConfirmationState;
};

/**
 * Builds the request context the handler reads: the per-request capability envelope, any answer
 * carried by a retried call, and the confirmation state that answer echoed back. Only the fields
 * `execute_query` touches are populated.
 *
 * `requestState` is an accessor returning the decoded payload rather than the wire string, because
 * that is what the server seam hands a handler once the configured verify hook has resolved with it.
 * `method` is populated because the codec's binding reads it.
 */
const createContext = ({ elicitation = true, inputResponses, requestState }: ContextOptions = {}): ServerContext =>
	({
		mcpReq: {
			method: 'tools/call',
			envelope: { [CLIENT_CAPABILITIES_META_KEY]: elicitation ? { elicitation: {} } : {} },
			inputResponses,
			requestState: () => requestState,
		},
	}) as unknown as ServerContext;

/** The arguments every round uses unless a test is deliberately changing the query between rounds. */
const queryArgs = { catalogueId: 'participants', sqon: EMPTY_ROOT_SQON, fields: ['study'] };

const run = async (contextOptions: ContextOptions = {}, args: Record<string, unknown> = queryArgs) => {
	const { client, calls } = createStubClient();
	const handler = captureHandler(client);
	const ctx = createContext(contextOptions);
	const result = await handler(args, ctx);
	return { result, calls, ctx };
};

/**
 * The state a first round mints for `args`, decoded the way the seam decodes it before re-entry.
 *
 * Verifying it here is not incidental: it is the same call `ServerOptions.requestState.verify` makes
 * at the seam, so a value that failed would fail there too and never reach the handler.
 */
const mintedStateFor = async (args: Record<string, unknown>): Promise<ConfirmationState> => {
	const { result, ctx } = await run({}, args);
	assert.ok(result.requestState, 'expected the first round to mint a requestState');
	return requestStateCodec.verify(result.requestState, ctx);
};

/**
 * Drives a whole confirmation: a first round asks, and a second answers with `response` while
 * echoing back the state the first minted, which is what a client does and what the seam then hands
 * the handler.
 * @param approvedArgs - Arguments the approved query was built from, when they differ from the ones
 * the answering round re-sends. Modelling an agent that shows one query and re-enters with another.
 * @param omitRequestState - Answers without echoing any state, which nothing in the protocol forces
 * a client to do.
 */
const answered = async (
	response: unknown,
	{
		args = queryArgs,
		approvedArgs = args,
		omitRequestState = false,
	}: { args?: Record<string, unknown>; approvedArgs?: Record<string, unknown>; omitRequestState?: boolean } = {},
) => {
	const requestState = omitRequestState ? undefined : await mintedStateFor(approvedArgs);
	return run({ inputResponses: { confirm: response }, requestState }, args);
};

suite('execute_query confirmation', () => {
	suite('a client that cannot elicit', () => {
		// The refusal is the whole point of the branch: with 2025-era serving gone this is the only
		// remaining route to running a query nobody approved.
		test('is refused rather than served unconfirmed', async () => {
			const { result } = await run({ elicitation: false });

			assert.equal(result.isError, true);
			assert.match(result.content?.[0]?.text ?? '', /elicitation/);
		});

		test('is refused before any Arranger request is made', async () => {
			const { calls } = await run({ elicitation: false });

			assert.equal(calls.introspection, 0, 'expected the refusal to cost no introspection round trip');
			assert.equal(calls.executed, 0);
		});
	});

	suite('the first round', () => {
		test('asks for confirmation instead of executing', async () => {
			const { result, calls } = await run();

			assert.equal(result.resultType, 'input_required');
			assert.equal(calls.executed, 0, 'expected nothing to run before the user answered');
		});

		test('shows the query and the catalogue it will run against', async () => {
			const { result } = await run();
			const message = result.inputRequests?.confirm?.params.message ?? '';

			assert.match(message, /participants/);
			assert.match(message, /ArrangerMcpExecuteQuery/);
		});
	});

	suite('the answer', () => {
		test('executes the query when the user accepts', async () => {
			const { result, calls } = await answered({ action: 'accept', content: { confirm: true } });

			assert.equal(calls.executed, 1);
			assert.equal(result.structuredContent?.executed, true);
		});

		test('does not execute when the user declines', async () => {
			const { result, calls } = await answered({ action: 'decline' });

			assert.equal(calls.executed, 0);
			assert.equal(result.structuredContent?.executed, false);
			assert.match(String(result.structuredContent?.message), /declined/);
		});

		test('does not execute when the user cancels', async () => {
			const { calls } = await answered({ action: 'cancel' });

			assert.equal(calls.executed, 0);
		});

		// The remaining cases are attacker-controlled input rather than anything a well-behaved
		// client sends, which is why they are pinned here and not in the integration suite.
		test('does not execute when the answer is accepted but withholds confirmation', async () => {
			const { calls } = await answered({ action: 'accept', content: { confirm: false } });

			assert.equal(calls.executed, 0);
		});

		test('does not execute when the accepted content fails the schema', async () => {
			const { calls } = await answered({ action: 'accept', content: { confirm: 'yes' } });

			assert.equal(calls.executed, 0, 'a non-boolean confirm must not be read as approval');
		});

		test('does not execute when the accepted content is missing entirely', async () => {
			const { calls } = await answered({ action: 'accept' });

			assert.equal(calls.executed, 0);
		});

		// A response the SDK cannot read arrives as absent, so the request is re-issued rather than
		// treated as either an approval or a refusal.
		test('re-asks when the answer is of a shape the SDK could not read', async () => {
			const { result, calls } = await answered({ method: 'elicitation/create', result: { confirm: true } });

			assert.equal(result.resultType, 'input_required');
			assert.equal(calls.executed, 0);
		});
	});

	// What ties an approval to the query it approved. Without it the second round rebuilds the query
	// from arguments the client re-sends, so an agent could show one query for confirmation and
	// execute another under the same answer.
	suite('the binding between the answer and the query', () => {
		const accept = { action: 'accept', content: { confirm: true } };

		test('the question travels with sealed state', async () => {
			const { result } = await run();

			assert.ok(result.requestState, 'expected the confirmation request to carry state');
		});

		test('the state is minted for the query that was shown, not for the call', async () => {
			const shown = await mintedStateFor(queryArgs);
			const other = await mintedStateFor({ ...queryArgs, first: 5 });

			assert.notEqual(shown.digest, other.digest, 'two different queries must not share one approval');
		});

		test('refuses an answer that echoes no state at all', async () => {
			const { result, calls } = await answered(accept, { omitRequestState: true });

			assert.equal(calls.executed, 0, 'an approval tied to no query is not an approval of this one');
			assert.equal(result.isError, true);
			assert.match(result.content?.[0]?.text ?? '', /requestState/);
		});

		test('refuses an approval that was minted for a different query', async () => {
			const { result, calls } = await answered(accept, { approvedArgs: { ...queryArgs, first: 5 } });

			assert.equal(calls.executed, 0, 'approval covers one exact query, not whatever the retry rebuilds');
			assert.equal(result.isError, true);
			assert.match(result.content?.[0]?.text ?? '', /confirmed/);
			// Refused rather than re-asked: asking again would hand a caller an unlimited retry loop
			// against the confirmation gate.
			assert.notEqual(result.resultType, 'input_required');
		});
	});
});
