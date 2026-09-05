import assert from 'node:assert/strict';
import { type AddressInfo } from 'node:net';
import { suite, test } from 'node:test';

import { type ArrangerClient } from '#arranger/client.js';
import { startMcpHttpServer } from '#http/server.js';
import { createConfirmationCodec } from '#mcp/requestState.js';
import { createMcpServer } from '#server.js';
import { type ArrangerMcpConfig } from '#utils/config.js';

/** Fixed HMAC key so the confirmation codec is deterministic and does not warn about a per-process one. */
const TEST_SIGNING_KEY = 'arranger-mcp-test-request-state-signing-key';

/** The revision this endpoint serves, and the only one it accepts. */
const PROTOCOL_REVISION = '2026-07-28';

const config: ArrangerMcpConfig = {
	arrangerBaseUrl: 'https://arranger.test',
	catalogues: ['participants'],
	requestTimeoutMs: 10_000,
	mcp: {
		host: '127.0.0.1',
		port: 0,
		path: '/mcp',
		allowedHosts: ['127.0.0.1'],
		allowedOrigins: [],
		requestStateSecret: TEST_SIGNING_KEY,
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

const executeQueryArguments = { catalogueId: 'participants', sqon: { op: 'and', content: [] }, fields: ['study'] };

/** The accepted answer a client attaches once the user has approved the query. */
const APPROVED = { confirm: { action: 'accept', content: { confirm: true } } };

type CallResponse = {
	result?: { resultType?: string; requestState?: string; structuredContent?: { executed?: boolean } };
	error?: { code: number; data?: { reason?: string } };
};

/**
 * The whole server as `startServer` assembles it, reached over its real HTTP endpoint.
 *
 * Driven with `fetch` rather than through the SDK client because these tests need to send material a
 * well-behaved client never would: the point is what the server does with a `requestState` somebody
 * has altered in transit.
 *
 * The stubbed Arranger client records the queries it was asked to run, which is what a refusal has
 * to leave empty.
 */
const startTestServer = async () => {
	const executed: string[] = [];
	const client = {
		getServerIntrospection: () => Promise.resolve(serverIntrospection),
		getCatalogueIntrospection: () => Promise.resolve(catalogueIntrospection),
		executeQuery: (_endpoint: string, request: { query: string; rootFieldName: string }) => {
			executed.push(request.query);
			return Promise.resolve({ data: { [request.rootFieldName]: { hits: { total: 1, edges: [] } } } });
		},
	} as unknown as ArrangerClient;

	const requestStateCodec = createConfirmationCodec(config);
	const { httpServer, close } = await startMcpHttpServer(config, () =>
		createMcpServer({ config, client, requestStateCodec }),
	);
	const { port } = httpServer.address() as AddressInfo;

	/** Calls `execute_query`, adding whatever multi-round-trip material the round is testing. */
	const callExecuteQuery = async (params: Record<string, unknown> = {}): Promise<CallResponse> => {
		const response = await fetch(`http://127.0.0.1:${port}${config.mcp.path}`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				accept: 'application/json, text/event-stream',
				// The revision header is what classifies the call as modern; the method and name
				// headers are required of every modern call and refused as a mismatch when absent.
				'mcp-protocol-version': PROTOCOL_REVISION,
				'mcp-method': 'tools/call',
				'mcp-name': 'execute_query',
			},
			body: JSON.stringify({
				jsonrpc: '2.0',
				id: 1,
				method: 'tools/call',
				params: {
					name: 'execute_query',
					arguments: executeQueryArguments,
					_meta: {
						'io.modelcontextprotocol/protocolVersion': PROTOCOL_REVISION,
						'io.modelcontextprotocol/clientCapabilities': { elicitation: {} },
					},
					...params,
				},
			}),
		});
		return response.json() as Promise<CallResponse>;
	};

	return { callExecuteQuery, executed, close };
};

suite('createMcpServer request state', () => {
	test('a confirmed query runs when the state minted with the question comes back', async () => {
		const { callExecuteQuery, executed, close } = await startTestServer();
		try {
			const asked = await callExecuteQuery();
			assert.equal(asked.result?.resultType, 'input_required');
			assert.ok(asked.result?.requestState, 'expected the confirmation request to carry sealed state');

			const answered = await callExecuteQuery({
				inputResponses: APPROVED,
				requestState: asked.result.requestState,
			});

			assert.equal(answered.result?.structuredContent?.executed, true);
			assert.equal(executed.length, 1);
		} finally {
			await close();
		}
	});

	// The signature is what makes the digest inside the state worth comparing: unsigned, a caller
	// could simply claim the digest of whatever query it wanted to run. Verification is installed at
	// the seam, so an altered value is answered before `execute_query` is entered at all and none of
	// the tool's own checks come into it.
	test('a state altered in transit is refused before the tool runs', async () => {
		const { callExecuteQuery, executed, close } = await startTestServer();
		try {
			const minted = (await callExecuteQuery()).result?.requestState ?? '';
			const altered = minted.slice(0, -4) + (minted.endsWith('AAAA') ? 'BBBB' : 'AAAA');
			assert.notEqual(altered, minted);

			const refused = await callExecuteQuery({ inputResponses: APPROVED, requestState: altered });

			assert.equal(refused.error?.code, -32602);
			assert.equal(refused.error?.data?.reason, 'invalid_request_state');
			assert.equal(executed.length, 0, 'a refused round must cost Arranger nothing');
		} finally {
			await close();
		}
	});
});
