import assert from 'node:assert/strict';
import http from 'node:http';
import { type AddressInfo } from 'node:net';
import { after, before, suite, test } from 'node:test';

import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { McpServer } from '@modelcontextprotocol/server';
import { z as zod } from 'zod';

import { startMcpHttpServer, type McpHttpServer } from '#http/server.js';
import { type ArrangerMcpConfig } from '#utils/config.js';

const MAX_BODY_BYTES = 1024;

const baseConfig = (mcp: Partial<ArrangerMcpConfig['mcp']>): ArrangerMcpConfig => ({
	arrangerBaseUrl: 'https://arranger.test',
	catalogues: ['participants'],
	requestTimeoutMs: 1000,
	mcp: {
		host: '127.0.0.1',
		port: 0,
		path: '/mcp',
		allowedHosts: ['arranger-mcp'],
		allowedOrigins: [],
		maxBodyBytes: MAX_BODY_BYTES,
		...mcp,
	},
});

/** A server with no registered surface: these tests assert transport behaviour, not tool behaviour. */
const emptyServerFactory = () => new McpServer({ name: 'transport-test', version: '0.0.0-test' });

type Response = { status: number; body: string };

/**
 * Sends a request with full control over the `Host` header, which `fetch` silently drops. A
 * fetch-based probe reports a false pass against Host validation, which is how the 403 this suite
 * pins went unnoticed.
 *
 * The default `Host` carries a port, because that is what a real client sends. The guard compares
 * `new URL('http://' + header).hostname`, so the port has to be stripped for the allowlist to match
 * at all; sending a bare hostname here would leave that stripping unexercised.
 */
const request = (
	port: number,
	{
		method = 'POST',
		path = '/mcp',
		headers = {},
		body,
		omitContentLength = false,
	}: {
		method?: string;
		path?: string;
		headers?: Record<string, string>;
		body?: string | Buffer;
		/** Sends the body with chunked transfer encoding, so its size is not declared up front. */
		omitContentLength?: boolean;
	},
): Promise<Response> =>
	new Promise((resolve, reject) => {
		const payload = typeof body === 'string' ? Buffer.from(body) : body;
		const req = http.request(
			{
				host: '127.0.0.1',
				port,
				path,
				method,
				headers: {
					host: `arranger-mcp:${port}`,
					'content-type': 'application/json',
					...(payload && !omitContentLength ? { 'content-length': String(payload.byteLength) } : {}),
					...headers,
				},
			},
			(res) => {
				let collected = '';
				res.on('data', (chunk) => (collected += chunk));
				res.on('end', () => resolve({ status: res.statusCode ?? 0, body: collected }));
			},
		);
		req.on('error', reject);
		req.end(payload);
	});

/** A 2025-era `initialize`: no per-request `_meta` envelope, so the handler classifies it legacy. */
const legacyInitialize = JSON.stringify({
	jsonrpc: '2.0',
	id: 1,
	method: 'initialize',
	params: {
		protocolVersion: '2025-11-25',
		capabilities: {},
		clientInfo: { name: 'probe', version: '0.0.0' },
	},
});

suite('startMcpHttpServer', () => {
	let server: McpHttpServer;
	let port: number;

	before(async () => {
		server = await startMcpHttpServer(baseConfig({}), emptyServerFactory);
		port = (server.httpServer.address() as AddressInfo).port;
	});

	after(async () => {
		await server.close();
	});

	suite('DNS rebinding guards', () => {
		test('serves a request whose Host header is in the allowlist', async () => {
			const { status } = await request(port, { body: legacyInitialize });

			// Reaching the handler at all is the assertion: it answers, rather than the guard refusing.
			assert.equal(status, 400);
		});

		test('serves a Host header carrying no port', async () => {
			const { status } = await request(port, { headers: { host: 'arranger-mcp' }, body: legacyInitialize });

			assert.notEqual(status, 403);
		});

		test('refuses a Host header outside the allowlist', async () => {
			const { status, body } = await request(port, {
				headers: { host: 'evil.example.com' },
				body: legacyInitialize,
			});

			assert.equal(status, 403);
			assert.match(body, /Invalid Host/);
		});

		test('refuses a request with no Host header', async () => {
			// `http.request` supplies one unless it is explicitly emptied.
			const { status } = await request(port, { headers: { host: '' }, body: legacyInitialize });

			assert.equal(status, 403);
		});

		test('refuses a browser Origin when the allowlist is empty', async () => {
			const { status, body } = await request(port, {
				headers: { origin: 'https://portal.example.com' },
				body: legacyInitialize,
			});

			assert.equal(status, 403);
			assert.match(body, /Origin/i);
		});

		test('allows a request carrying no Origin, which is every non-browser MCP client', async () => {
			const { status } = await request(port, { body: legacyInitialize });

			assert.notEqual(status, 403);
		});
	});

	suite('request body cap', () => {
		test('refuses a body over the cap declared by content-length', async () => {
			const { status, body } = await request(port, { body: 'x'.repeat(MAX_BODY_BYTES + 1) });

			assert.equal(status, 413);
			assert.match(body, /exceeds the 1024 byte limit/);
		});

		// The content-length check is only an early out. Chunked encoding declares no size, so this
		// is the case the running byte count has to catch on its own.
		test('refuses an oversized body that hides its size with chunked encoding', async () => {
			const { status } = await request(port, {
				body: 'x'.repeat(MAX_BODY_BYTES + 1),
				omitContentLength: true,
			});

			assert.equal(status, 413);
		});

		// The check is `received > maxBytes`, so a body of exactly the cap is served. Pinned because
		// nothing else would catch that becoming `>=`.
		test('serves a body of exactly the cap', async () => {
			const envelope = { jsonrpc: '2.0', id: 1, method: 'initialize', pad: '' };
			const padding = 'a'.repeat(MAX_BODY_BYTES - Buffer.byteLength(JSON.stringify(envelope)));
			const payload = JSON.stringify({ ...envelope, pad: padding });
			assert.equal(Buffer.byteLength(payload), MAX_BODY_BYTES, 'test payload must sit exactly on the cap');

			const { status } = await request(port, { body: payload });

			assert.notEqual(status, 413);
		});

		test('serves a body just under the cap', async () => {
			const envelope = { jsonrpc: '2.0', id: 1, method: 'initialize', pad: '' };
			const padding = 'a'.repeat(MAX_BODY_BYTES - JSON.stringify(envelope).length);
			const payload = JSON.stringify({ ...envelope, pad: padding });
			assert.ok(Buffer.byteLength(payload) <= MAX_BODY_BYTES, 'test payload must fit under the cap');

			const { status } = await request(port, { body: payload });

			assert.notEqual(status, 413);
		});
	});

	suite('malformed input', () => {
		test('answers a body that is not valid JSON with a parse error', async () => {
			const { status, body } = await request(port, { body: '{ not json' });

			assert.equal(status, 400);
			assert.equal(JSON.parse(body).error.code, -32700);
		});
	});

	suite('routing', () => {
		test('answers a path other than the configured MCP endpoint with 404', async () => {
			const { status, body } = await request(port, { path: '/not-mcp', body: legacyInitialize });

			assert.equal(status, 404);
			assert.match(body, /The MCP endpoint is \/mcp/);
		});

		test('ignores a query string when matching the endpoint', async () => {
			const { status } = await request(port, { path: '/mcp?trace=1', body: legacyInitialize });

			assert.notEqual(status, 404);
		});
	});

	suite('protocol era', () => {
		test('refuses a 2025-era request, naming the revision this endpoint serves', async () => {
			const { status, body } = await request(port, { body: legacyInitialize });
			const { error } = JSON.parse(body);

			assert.equal(status, 400);
			assert.equal(error.code, -32022);
			assert.deepEqual(error.data.supported, ['2026-07-28']);
		});

		test('answers a 2025-era session GET without opening a stream', async () => {
			const { status } = await request(port, { method: 'GET', headers: { accept: 'text/event-stream' } });

			assert.equal(status, 405);
		});
	});
});

/**
 * The rest of this file asserts what the transport refuses. This suite asserts that it serves:
 * guards passed, body read and parsed, the web-standard handler bridged back onto `node:http`, and a
 * real answer returned. Without it the file would pass against a server that refuses everything.
 *
 * It uses a real client rather than a hand-built request because a `2026-07-28` call carries a
 * per-request `_meta` envelope that is not worth reproducing by hand. The client is a devDependency,
 * so it does not reach the published image.
 */
suite('startMcpHttpServer serving a modern client', () => {
	let server: McpHttpServer;
	let client: Client;

	before(async () => {
		server = await startMcpHttpServer(
			// The client dials 127.0.0.1, so that is the hostname its `Host` header carries.
			baseConfig({ allowedHosts: ['127.0.0.1'] }),
			() => {
				const mcpServer = new McpServer({ name: 'transport-test', version: '0.0.0-test' });
				mcpServer.registerTool(
					'echo',
					{ description: 'Returns what it was given.', inputSchema: zod.object({ value: zod.string() }) },
					({ value }) => ({ content: [{ type: 'text', text: `echoed ${value}` }] }),
				);
				return mcpServer;
			},
		);

		const { port } = server.httpServer.address() as AddressInfo;
		client = new Client(
			{ name: 'transport-test-client', version: '0.0.0-test' },
			// Pinned, not 'auto': 'auto' falls back to the 2025 handshake, which this endpoint
			// refuses, and the fallback is silent.
			{ versionNegotiation: { mode: { pin: '2026-07-28' } } },
		);
		await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)));
	});

	after(async () => {
		await client.close();
		await server.close();
	});

	test('completes the connect handshake and reports the server it reached', () => {
		assert.equal(client.getServerVersion()?.name, 'transport-test');
	});

	test('serves tools/list', async () => {
		const { tools } = await client.listTools();

		assert.deepEqual(
			tools.map(({ name }) => name),
			['echo'],
		);
	});

	test('serves tools/call, round-tripping arguments and result', async () => {
		const result = await client.callTool({ name: 'echo', arguments: { value: 'hello' } });

		assert.deepEqual(result.content, [{ type: 'text', text: 'echoed hello' }]);
	});
});

suite('startMcpHttpServer with Host validation delegated', () => {
	test('serves any Host header when MCP_ALLOWED_HOSTS is "*"', async () => {
		const server = await startMcpHttpServer(baseConfig({ allowedHosts: 'any' }), emptyServerFactory);
		const port = (server.httpServer.address() as AddressInfo).port;

		try {
			const { status } = await request(port, {
				headers: { host: 'anything.example.com' },
				body: legacyInitialize,
			});

			assert.notEqual(status, 403);
		} finally {
			await server.close();
		}
	});
});
