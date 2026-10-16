import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { type Tool } from '@modelcontextprotocol/client';

import { canonicalizeSurface, hashSurface, type RawSurface, toSurfaceSnapshot } from './surface.js';

type Properties = Tool['inputSchema']['properties'];

const tool = (name: string, extra: Record<string, unknown> = {}) => ({
	name,
	inputSchema: { type: 'object' as const, properties: { query: { type: 'string' } } },
	...extra,
});

const tools = [tool('alpha'), tool('beta')];

const raw = (overrides: Partial<RawSurface> = {}): RawSurface => ({
	discover: {
		supportedVersions: ['2026-07-28'],
		capabilities: { tools: { listChanged: true } },
		instructions: 'Be careful.',
	},
	tools: { tools },
	...overrides,
});

const hashOf = (surface: RawSurface) => hashSurface(toSurfaceSnapshot(surface));

suite('surface snapshot and hash', () => {
	test('leaves out result-level _meta, cache fields and cursors', () => {
		const plain = raw();
		const decorated = raw({
			discover: {
				...plain.discover,
				...{
					_meta: { 'io.modelcontextprotocol/serverInfo': { name: 's', version: '2.0.0' } },
					ttlMs: 60_000,
					cacheScope: 'public',
				},
			},
			tools: {
				tools,
				...{
					_meta: { 'io.modelcontextprotocol/serverInfo': { name: 's', version: '2.0.0' } },
					ttlMs: 60_000,
					nextCursor: 'x',
				},
			},
		});

		assert.equal(hashOf(decorated), hashOf(plain));
		assert.deepEqual(Object.keys(toSurfaceSnapshot(decorated)).sort(), [
			'capabilities',
			'instructions',
			'prompts',
			'resourceTemplates',
			'resources',
			'supportedVersions',
			'tools',
		]);
	});

	test('keeps an item’s own _meta', () => {
		const withMeta = raw({ tools: { tools: [tool('alpha', { _meta: { hint: 'read-only' } }), tool('beta')] } });

		assert.notEqual(hashOf(withMeta), hashOf(raw()));
	});

	test('keeps an input-schema property named _meta', () => {
		const withProperty = raw({
			tools: {
				tools: [
					{
						name: 'alpha',
						inputSchema: {
							type: 'object',
							properties: { query: { type: 'string' }, _meta: { type: 'object' } },
						},
					},
					tool('beta'),
				],
			},
		});

		assert.notEqual(hashOf(withProperty), hashOf(raw()));
		assert.match(canonicalizeSurface(toSurfaceSnapshot(withProperty)), /"_meta":\{"type":"object"\}/);
	});

	test('ignores object key order', () => {
		const reordered = raw({
			tools: {
				tools: [
					{ inputSchema: { properties: { query: { type: 'string' } }, type: 'object' }, name: 'alpha' },
					tool('beta'),
				],
			},
		});

		assert.equal(hashOf(reordered), hashOf(raw()));
	});

	test('keeps list order, which the model sees', () => {
		const reversed = raw({ tools: { tools: [tool('beta'), tool('alpha')] } });

		assert.notEqual(hashOf(reversed), hashOf(raw()));
	});

	test('records an unadvertised list as empty', () => {
		const snapshot = toSurfaceSnapshot(raw());

		assert.deepEqual(snapshot.prompts, []);
		assert.deepEqual(snapshot.resources, []);
		assert.deepEqual(snapshot.resourceTemplates, []);
	});

	test('drops undefined properties, as JSON does', () => {
		const snapshot = toSurfaceSnapshot(raw({ discover: { supportedVersions: ['2026-07-28'], capabilities: {} } }));

		assert.equal(canonicalizeSurface({ ...snapshot, instructions: undefined }), canonicalizeSurface(snapshot));
	});

	test('writes JSON with sorted keys and kept list order', () => {
		const snapshot = toSurfaceSnapshot({
			discover: { supportedVersions: ['2026-07-28'], capabilities: {} },
			tools: { tools: [{ name: 'b', inputSchema: { type: 'object', required: ['y', 'x'] } }] },
		});

		assert.equal(
			canonicalizeSurface(snapshot),
			'{"capabilities":{},"prompts":[],"resourceTemplates":[],"resources":[],"supportedVersions":["2026-07-28"],' +
				'"tools":[{"inputSchema":{"required":["y","x"],"type":"object"},"name":"b"}]}',
		);
	});

	test('hashes a deeply nested surface without overflowing the stack', () => {
		let deep: Record<string, unknown> = {};
		for (let level = 0; level < 100_000; level += 1) {
			deep = { next: deep };
		}
		const snapshot = toSurfaceSnapshot(
			raw({
				tools: {
					tools: [{ name: 'deep', inputSchema: { type: 'object', properties: deep as Properties } }],
				},
			}),
		);

		assert.match(hashSurface(snapshot), /^[0-9a-f]{64}$/);
	});

	test('is lowercase hex SHA-256', () => {
		assert.match(hashOf(raw()), /^[0-9a-f]{64}$/);
	});
});
