import { ResourceTemplate, type McpServer } from '@modelcontextprotocol/sdk/server/mcp';

import { type McpServerDeps } from '#server.js';

const JSON_MIME = 'application/json';

export const registerResources = (server: McpServer, { client }: McpServerDeps): void => {
	server.registerResource(
		'arranger-server-introspection',
		'arranger://introspection/server',
		{
			title: 'Arranger Server Introspection',
			description: 'Arranger-wide server summary and catalog inventory (GET /introspection).',
			mimeType: JSON_MIME,
		},
		async (uri) => {
			const data = await client.getServerIntrospection();
			return {
				contents: [{ uri: uri.href, mimeType: JSON_MIME, text: JSON.stringify(data, null, 2) }],
			};
		},
	);

	server.registerResource(
		'arranger-sqon-schema',
		'arranger://introspection/sqon',
		{
			title: 'SQON Schema',
			description:
				'Shared SQON Schema and SQON operator metadata for this Arranger instance (GET /introspection/sqon).',
			mimeType: JSON_MIME,
		},
		async (uri) => {
			const data = await client.getSqonIntrospection();
			return {
				contents: [{ uri: uri.href, mimeType: JSON_MIME, text: JSON.stringify(data, null, 2) }],
			};
		},
	);

	server.registerResource(
		'arranger-catalog-fields',
		new ResourceTemplate('arranger://introspection/catalog/{catalogId}', {
			list: async () => {
				const { catalogs } = await client.getServerIntrospection();
				return {
					resources: Object.keys(catalogs).map((catalogId) => ({
						uri: `arranger://introspection/catalog/${catalogId}`,
						name: catalogId,
						mimeType: JSON_MIME,
					})),
				};
			},
		}),
		{
			title: 'Arranger Catalog Fields',
			description:
				'Per-catalog field metadata: displayName, type, unit, validOperators (GET /introspection/:catalogId).',
			mimeType: JSON_MIME,
		},
		async (uri, { catalogId }) => {
			const id = Array.isArray(catalogId) ? catalogId[0] : catalogId;
			const data = await client.getCatalogIntrospection(id);
			return {
				contents: [{ uri: uri.href, mimeType: JSON_MIME, text: JSON.stringify(data, null, 2) }],
			};
		},
	);
};
