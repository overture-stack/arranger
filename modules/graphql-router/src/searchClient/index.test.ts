import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';

import { detectClientTypeFromHeaders, getClientType, resolveClientTypeFromNodeInfo } from './index.js';

const node = 'http://localhost:9200';

const mockResponse = (status: number, body?: unknown, headers?: Record<string, string>): Response =>
	({
		ok: status >= 200 && status < 300,
		status,
		headers: new Headers(headers ?? {}),
		json: async () => body,
	}) as unknown as Response;

const esRootBody = { version: { number: '7.17.27' } };
const osRootBody = { version: { number: '2.17.0', distribution: 'opensearch' } };
const esNodesBody = { nodes: { abc123: { build_flavor: 'default', version: '7.17.27' } } };
const osNodesBody = { nodes: { def456: { build_flavor: 'oss', version: '2.17.0' } } };

suite('detectClientTypeFromHeaders', () => {
	test("returns 'elasticsearch' when the X-Elastic-Product header is 'Elasticsearch'", () => {
		const headers = new Headers({ 'x-elastic-product': 'Elasticsearch' });
		assert.equal(detectClientTypeFromHeaders(headers), 'elasticsearch');
	});

	test('returns undefined when the header is absent', () => {
		assert.equal(detectClientTypeFromHeaders(new Headers()), undefined);
	});

	test('returns undefined when the header value does not match', () => {
		const headers = new Headers({ 'x-elastic-product': 'OpenSearch' });
		assert.equal(detectClientTypeFromHeaders(headers), undefined);
	});
});

suite('resolveClientTypeFromNodeInfo', () => {
	test("returns 'elasticsearch' when build_flavor is 'default'", () => {
		assert.equal(resolveClientTypeFromNodeInfo({ build_flavor: 'default' }, node), 'elasticsearch');
	});

	test("returns 'opensearch' when build_flavor is 'oss'", () => {
		assert.equal(resolveClientTypeFromNodeInfo({ build_flavor: 'oss' }, node), 'opensearch');
	});

	test('returns undefined for an unrecognised build_flavor', () => {
		assert.equal(resolveClientTypeFromNodeInfo({ build_flavor: 'unknown' }, node), undefined);
	});

	test('returns undefined when build_flavor is absent', () => {
		assert.equal(resolveClientTypeFromNodeInfo({}, node), undefined);
	});
});

suite('getClientType', () => {
	let originalFetch: typeof globalThis.fetch;

	before(() => {
		originalFetch = globalThis.fetch;
	});
	after(() => {
		globalThis.fetch = originalFetch;
	});

	const setFetch = (handler: (url: string) => Response | Promise<Response>) => {
		globalThis.fetch = async (input: RequestInfo | URL) => handler(input.toString());
	};

	suite('explicit clientType', () => {
		test("returns the provided type when it is a supported value", async () => {
			const result = await getClientType({ node, clientType: 'opensearch' });
			assert.equal(result, 'opensearch');
		});

		test('returns undefined for an unsupported clientType value', async () => {
			const result = await getClientType({ node, clientType: 'solr' });
			assert.equal(result, undefined);
		});
	});

	suite('auto-detection via GET /', () => {
		test("detects elasticsearch from a 200 response with no distribution field", async () => {
			setFetch(() => mockResponse(200, esRootBody));
			assert.equal(await getClientType({ node }), 'elasticsearch');
		});

		test("detects opensearch from a 200 response with a distribution field", async () => {
			setFetch(() => mockResponse(200, osRootBody));
			assert.equal(await getClientType({ node }), 'opensearch');
		});

		test('returns undefined when the 200 response has no version field', async () => {
			setFetch(() => mockResponse(200, { tagline: 'Something else' }));
			assert.equal(await getClientType({ node }), undefined);
		});

		test('returns undefined and logs on a network error', async () => {
			globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
			assert.equal(await getClientType({ node }), undefined);
		});
	});

	suite('fallback detection: X-Elastic-Product header', () => {
		test("detects elasticsearch via response header when root endpoint returns 403", async () => {
			setFetch(() => mockResponse(403, {}, { 'x-elastic-product': 'Elasticsearch' }));
			assert.equal(await getClientType({ node }), 'elasticsearch');
		});

		test("detects elasticsearch via response header when root endpoint returns 401", async () => {
			setFetch(() => mockResponse(401, {}, { 'x-elastic-product': 'Elasticsearch' }));
			assert.equal(await getClientType({ node }), 'elasticsearch');
		});
	});

	suite('fallback detection: /_nodes/_local on 403', () => {
		test("detects opensearch via /_nodes/_local when root endpoint returns 403 without a product header", async () => {
			setFetch((url) =>
				url.includes('/_nodes/_local') ? mockResponse(200, osNodesBody) : mockResponse(403, {}),
			);
			assert.equal(await getClientType({ node }), 'opensearch');
		});

		test("detects elasticsearch via /_nodes/_local when root endpoint returns 403 without a product header", async () => {
			setFetch((url) =>
				url.includes('/_nodes/_local') ? mockResponse(200, esNodesBody) : mockResponse(403, {}),
			);
			assert.equal(await getClientType({ node }), 'elasticsearch');
		});

		test('returns undefined when 403 is received and /_nodes/_local also fails', async () => {
			setFetch((url) =>
				url.includes('/_nodes/_local') ? mockResponse(403, {}) : mockResponse(403, {}),
			);
			assert.equal(await getClientType({ node }), undefined);
		});

		test('does not attempt /_nodes/_local when root endpoint returns 401', async () => {
			let nodesCalled = false;
			setFetch((url) => {
				if (url.includes('/_nodes/_local')) {
					nodesCalled = true;
					return mockResponse(200, osNodesBody);
				}
				return mockResponse(401, {});
			});
			await getClientType({ node });
			assert.equal(nodesCalled, false);
		});
	});

	suite('auth header forwarding', () => {
		test('passes basic auth credentials to GET /', async () => {
			let capturedHeaders: Record<string, string> = {};
			setFetch((_, ...rest) => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				capturedHeaders = Object.fromEntries((rest[0] as any)?.headers ?? new Headers());
				return mockResponse(200, esRootBody);
			});

			// Manually intercept headers from fetch call
			const calls: string[] = [];
			globalThis.fetch = async (input, init) => {
				calls.push(JSON.stringify(init?.headers));
				return mockResponse(200, esRootBody);
			};

			await getClientType({ node, auth: { username: 'user', password: 'pass' } });
			const sentHeaders = JSON.parse(calls[0] ?? '{}') as Record<string, string>;
			assert.ok(sentHeaders['Authorization']?.startsWith('Basic '), 'Authorization header should be sent');
		});

		test('sends no Authorization header when auth is not configured', async () => {
			const calls: string[] = [];
			globalThis.fetch = async (input, init) => {
				calls.push(JSON.stringify(init?.headers));
				return mockResponse(200, esRootBody);
			};

			await getClientType({ node });
			const sentHeaders = JSON.parse(calls[0] ?? '{}') as Record<string, string>;
			assert.equal(sentHeaders['Authorization'], undefined);
		});
	});
});
