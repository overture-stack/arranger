import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { z as zod } from 'zod';

import {
	catalogueIntrospectionSchema,
	cataloguesSchema,
	serverIntrospectionSchema,
	sqonIntrospectionSchema,
} from '#arranger/types.js';
import { type McpServerDeps } from '#server.js';

export const registerTools = (server: McpServer, { client }: McpServerDeps): void => {
	server.registerTool(
		'list-catalogues',
		{
			title: 'List Arranger Catalogues',
			description: 'Returns the catalogues exposed by the connected Arranger server.',
			outputSchema: zod.object({ catalogues: cataloguesSchema }),
		},
		async () => {
			const data = await client.getServerIntrospection();
			const { catalogs: catalogues } = serverIntrospectionSchema.parse(data);
			const catalogueIds = Object.keys(catalogues);
			return {
				content: [{ type: 'text', text: `Available catalogs: ${catalogueIds.join(', ')}` }],
				structuredContent: { catalogues },
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
		'get-catalogue-fields',
		{
			title: 'Get Catalogue Fields',
			description:
				'Return field introspection for one catalogue. `operators` maps each field type to its valid SQON operators. `fields` lists each field with its `type`, `displayName`, optional `unit`, and optional `description`.',
			inputSchema: {
				catalogueId: zod
					.string()
					.min(1)
					.describe('Catalogue identifier from the Arranger /introspection payload.'),
			},
			outputSchema: catalogueIntrospectionSchema,
		},
		async ({ catalogueId }) => {
			const data = await client.getCatalogueIntrospection(catalogueId);
			const catalogueIntrospection = catalogueIntrospectionSchema.parse(data);
			return {
				content: [{ type: 'text', text: JSON.stringify(catalogueIntrospection, null, 2) }],
				structuredContent: catalogueIntrospection,
			};
		},
	);
};
