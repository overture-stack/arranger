import assert from 'node:assert';
import { mock, suite, test } from 'node:test';

import { type ArrangerIntrospectionClient } from '#arranger/client.js';
import type {
	ArrangerCatalogueIntrospection,
	ArrangerServerIntrospection,
	ArrangerSqonIntrospection,
} from '#arranger/types.js';
import { validateArrangerConnection } from '#arranger/validation.js';
import { type ArrangerMcpConfig } from '#utils/config.js';

const mockConfig = (catalogues: string[] = ['catalogue-a']): ArrangerMcpConfig => ({
	arrangerBaseUrl: 'http://arranger.test',
	catalogues,
	requestTimeoutMs: 1000,
	mcp: {
		host: '0.0.0.0',
		port: 3100,
		path: '/mcp',
	},
});

const mockServerIntrospection = (catalogueIds: string[]): ArrangerServerIntrospection => ({
	catalogCount: catalogueIds.length,
	catalogs: Object.fromEntries(
		catalogueIds.map((id) => [
			id,
			{
				documentType: 'doc',
				paths: {
					graphql: `/${id}/graphql`,
					introspection: `/introspection/${id}`,
				},
			},
		]),
	),
	mode: catalogueIds.length > 1 ? 'multiple' : 'single',
	sqonSchemaPath: '/introspection/sqon',
});

const mockSqonIntrospection = (): ArrangerSqonIntrospection => ({
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	aliases: {},
	description: '',
	operators: { combination: [], field: [] },
	schema: {},
	title: 'SQON',
	version: '0.0.0',
});

const mockCatalogueIntrospection = (catalogueId: string): ArrangerCatalogueIntrospection => ({
	catalogId: catalogueId,
	documentType: 'doc',
	generatedAt: '2026-01-01T00:00:00Z',
	meta: { authFiltered: false },
	operators: {},
	fields: {},
});

const mockClient = (overrides: Partial<ArrangerIntrospectionClient> = {}): ArrangerIntrospectionClient => ({
	getServerIntrospection: mock.fn(async () => mockServerIntrospection(['catalogue-a'])),
	getSqonIntrospection: mock.fn(async () => mockSqonIntrospection()),
	getCatalogueIntrospection: mock.fn(async (id: string) => mockCatalogueIntrospection(id)),
	...overrides,
});

suite('validateArrangerConnection', () => {
	test('resolves when introspection succeeds and all configured catalogues are available', async () => {
		const config = mockConfig(['catalogue-a', 'catalogue-b']);
		const client = mockClient({
			getServerIntrospection: mock.fn(async () => mockServerIntrospection(['catalogue-a', 'catalogue-b'])),
		});

		await assert.doesNotReject(validateArrangerConnection(config, client));
	});

	test('throws when the /introspection endpoint is unreachable', async () => {
		const config = mockConfig();
		const client = mockClient({
			getServerIntrospection: mock.fn(async () => {
				throw new Error('Failed to fetch /introspection: 503 Service Unavailable');
			}),
		});

		await assert.rejects(validateArrangerConnection(config, client), {
			message: /Arranger connection validation failed:.*\/introspection.*503/,
		});
	});

	test('throws when the /introspection/sqon endpoint is unreachable', async () => {
		const config = mockConfig();
		const client = mockClient({
			getSqonIntrospection: mock.fn(async () => {
				throw new Error('Failed to fetch /introspection/sqon: 404 Not Found');
			}),
		});

		await assert.rejects(validateArrangerConnection(config, client), {
			message: /Arranger connection validation failed:.*\/introspection\/sqon.*404/,
		});
	});

	test('throws when a configured catalogue is not available on Arranger', async () => {
		const config = mockConfig(['catalogue-a', 'missing-catalogue']);
		const client = mockClient({
			getServerIntrospection: mock.fn(async () => mockServerIntrospection(['catalogue-a'])),
		});

		await assert.rejects(validateArrangerConnection(config, client), {
			message: /Configured catalogues not available on Arranger: missing-catalogue/,
		});
	});

	test('throws when a network error occurs during validation', async () => {
		const config = mockConfig();
		const client = mockClient({
			getServerIntrospection: mock.fn(async () => {
				throw new Error('fetch failed: ECONNREFUSED');
			}),
		});

		await assert.rejects(validateArrangerConnection(config, client), {
			message: /Arranger connection validation failed:.*ECONNREFUSED/,
		});
	});
});
