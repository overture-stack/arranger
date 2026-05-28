import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { z } from 'zod';

import { type McpServerDeps } from '#server.js';

const fieldShape = z.object({
	displayName: z.string(),
	type: z.string(),
	unit: z.string().nullable().optional(),
	validOperators: z.array(z.string()),
});

export const registerTools = (server: McpServer, { client }: McpServerDeps): void => {
	server.registerTool(
		'list-catalogs',
		{
			title: 'List Arranger Catalogs',
			description: 'Returns the catalogs exposed by the connected Arranger server.',
		},
		async () => {
			const { catalogs } = await client.getServerIntrospection();
			const ids = Object.keys(catalogs);
			return { content: [{ type: 'text', text: `Available catalogs: ${ids.join(', ')}` }] };
		},
	);

	server.registerTool(
		'get-sqon-schema',
		{
			title: 'Get SQON Schema',
			description: 'Returns the shared SQON Schema and operator metadata for the connected Arranger server.',
		},
		async () => {
			const data = await client.getSqonIntrospection();
			return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
		},
	);

	server.registerTool(
		'get-catalog-fields',
		{
			title: 'Get Catalog Fields',
			description:
				'Return field introspection for one catalogue. `operators` maps each field type to its valid SQON operators. `fields` lists each field with its `type`, `displayName`, optional `unit`, and optional `description`.',
			inputSchema: {
				catalogId: z.string().min(1).describe('Catalog identifier from the Arranger /introspection payload.'),
			},
			outputSchema: { catalogId: z.string(), fields: z.record(fieldShape) },
		},
		async ({ catalogId }) => {
			const data = await client.getCatalogIntrospection(catalogId);
			const structured = { catalogId: data.catalogId, fields: data.fields };
			return {
				content: [{ type: 'text', text: JSON.stringify(structured, null, 2) }],
				structuredContent: structured,
			};
		},
	);
};
