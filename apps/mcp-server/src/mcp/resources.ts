import { ResourceTemplate, type McpServer } from '@modelcontextprotocol/sdk/server/mcp';

import { type McpServerDeps } from '#server.js';

const JSON_MIME = 'application/json';

export const registerResources = (server: McpServer, { client }: McpServerDeps): void => {
	server.registerResource(
		'arranger-server-introspection',
		'arranger://introspection/server',
		{
			title: 'Arranger Server Introspection',
			description: 'Arranger-wide server summary and catalogue inventory (GET /introspection).',
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
		'arranger-catalogue-fields',
		new ResourceTemplate('arranger://introspection/catalog/{catalogueId}', {
			list: async () => {
				const { catalogs: catalogues } = await client.getServerIntrospection();
				return {
					resources: Object.keys(catalogues).map((catalogueId) => ({
						uri: `arranger://introspection/catalog/${catalogueId}`,
						name: catalogueId,
						mimeType: JSON_MIME,
					})),
				};
			},
		}),
		{
			title: 'Arranger Catalogue Fields',
			description:
				'Per-catalogue field metadata: displayName, type, unit, validOperators (GET /introspection/:catalogueId).',
			mimeType: JSON_MIME,
		},
		async (uri, { catalogueId }) => {
			const id = Array.isArray(catalogueId) ? catalogueId[0] : catalogueId;
			const data = await client.getCatalogueIntrospection(id);
			return {
				contents: [{ uri: uri.href, mimeType: JSON_MIME, text: JSON.stringify(data, null, 2) }],
			};
		},
	);
};
