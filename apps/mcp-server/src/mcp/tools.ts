import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { z as zod } from 'zod';

import {
	catalogIntrospectionSchema,
	catalogsSchema,
	serverIntrospectionSchema,
	sqonIntrospectionSchema,
} from '#arranger/types.js';
import { type McpServerDeps } from '#server.js';

export const registerTools = (server: McpServer, { client }: McpServerDeps): void => {
	server.registerTool(
		'list-catalogs',
		{
			title: 'List Arranger Catalogs',
			description: 'Returns the catalogs exposed by the connected Arranger server.',
			outputSchema: zod.object({ catalogs: catalogsSchema }),
		},
		async () => {
			const data = await client.getServerIntrospection();
			const { catalogs } = serverIntrospectionSchema.parse(data);
			const catalogIds = Object.keys(catalogs);
			return {
				content: [{ type: 'text', text: `Available catalogs: ${catalogIds.join(', ')}` }],
				structuredContent: { catalogs },
			};
		},
	);

	server.registerTool(
		'get-sqon-schema',
		{
			title: 'Get SQON Schema',
			description: 'Returns the shared SQON Schema and operator metadata for the connected Arranger server.',
			outputSchema: sqonIntrospectionSchema,
		},
		async () => {
			const data = await client.getSqonIntrospection();
			const sqonSchema = sqonIntrospectionSchema.parse(data);
			return {
				content: [{ type: 'text', text: JSON.stringify(sqonSchema) }],
				structuredContent: sqonSchema,
			};
		},
	);

	server.registerTool(
		'get-catalog-fields',
		{
			title: 'Get Catalog Fields',
			description:
				'Return field introspection for one catalogue. `operators` maps each field type to its valid SQON operators. `fields` lists each field with its `type`, `displayName`, optional `unit`, and optional `description`.',
			inputSchema: {
				catalogId: zod.string().min(1).describe('Catalog identifier from the Arranger /introspection payload.'),
			},
			outputSchema: catalogIntrospectionSchema,
		},
		async ({ catalogId }) => {
			const data = await client.getCatalogIntrospection(catalogId);
			const catalogIntrospection = catalogIntrospectionSchema.parse(data);
			return {
				content: [{ type: 'text', text: JSON.stringify(catalogIntrospection, null, 2) }],
				structuredContent: catalogIntrospection,
			};
		},
	);
};
