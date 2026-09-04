import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { CLIENT_CAPABILITIES_META_KEY, type McpServer, type ServerContext } from '@modelcontextprotocol/server';

import { type ArrangerClient } from '#arranger/client.js';
import { registerExecuteQueryTool } from '#mcp/executeQueryTool.js';
import { type ArrangerMcpConfig } from '#utils/config.js';

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
		maxBodyBytes: 102_400,
	},
};

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

	registerExecuteQueryTool(server as unknown as McpServer, { client, config });

	if (!handler) {
		throw new Error('registerExecuteQueryTool registered no handler');
	}
	return handler;
};

/**
 * Builds the request context the handler reads: the per-request capability envelope, and any answer
 * carried by a retried call. Only the fields `execute_query` touches are populated.
 */
const createContext = ({
	elicitation = true,
	inputResponses,
}: {
	elicitation?: boolean;
	inputResponses?: Record<string, unknown>;
} = {}): ServerContext =>
	({
		mcpReq: {
			envelope: { [CLIENT_CAPABILITIES_META_KEY]: elicitation ? { elicitation: {} } : {} },
			inputResponses,
		},
	}) as unknown as ServerContext;

const run = async (contextOptions: Parameters<typeof createContext>[0] = {}) => {
	const { client, calls } = createStubClient();
	const handler = captureHandler(client);
	const result = await handler(
		{ catalogueId: 'participants', sqon: EMPTY_ROOT_SQON, fields: ['study'] },
		createContext(contextOptions),
	);
	return { result, calls };
};

/** The answer shape a client attaches to the retried call after fulfilling the elicitation. */
const answered = (response: unknown) => ({ elicitation: true, inputResponses: { confirm: response } });

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
			const { result, calls } = await run(answered({ action: 'accept', content: { confirm: true } }));

			assert.equal(calls.executed, 1);
			assert.equal(result.structuredContent?.executed, true);
		});

		test('does not execute when the user declines', async () => {
			const { result, calls } = await run(answered({ action: 'decline' }));

			assert.equal(calls.executed, 0);
			assert.equal(result.structuredContent?.executed, false);
			assert.match(String(result.structuredContent?.message), /declined/);
		});

		test('does not execute when the user cancels', async () => {
			const { calls } = await run(answered({ action: 'cancel' }));

			assert.equal(calls.executed, 0);
		});

		// The remaining cases are attacker-controlled input rather than anything a well-behaved
		// client sends, which is why they are pinned here and not in the integration suite.
		test('does not execute when the answer is accepted but withholds confirmation', async () => {
			const { calls } = await run(answered({ action: 'accept', content: { confirm: false } }));

			assert.equal(calls.executed, 0);
		});

		test('does not execute when the accepted content fails the schema', async () => {
			const { calls } = await run(answered({ action: 'accept', content: { confirm: 'yes' } }));

			assert.equal(calls.executed, 0, 'a non-boolean confirm must not be read as approval');
		});

		test('does not execute when the accepted content is missing entirely', async () => {
			const { calls } = await run(answered({ action: 'accept' }));

			assert.equal(calls.executed, 0);
		});

		// A response the SDK cannot read arrives as absent, so the request is re-issued rather than
		// treated as either an approval or a refusal.
		test('re-asks when the answer is of a shape the SDK could not read', async () => {
			const { result, calls } = await run(answered({ method: 'elicitation/create', result: { confirm: true } }));

			assert.equal(result.resultType, 'input_required');
			assert.equal(calls.executed, 0);
		});
	});
});
