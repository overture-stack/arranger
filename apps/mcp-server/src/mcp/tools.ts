import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { z as zod } from 'zod';

import {
	catalogueIntrospectionSchema,
	cataloguesSchema,
	serverIntrospectionSchema,
	sqonIntrospectionSchema,
} from '#arranger/types.js';
import { registerExecuteQueryTool } from '#mcp/executeQueryTool.js';
import { SQON_CHEAT_SHEET } from '#mcp/sqonCheatSheet.js';
import { type McpServerDeps } from '#server.js';

export const registerTools = (server: McpServer, deps: McpServerDeps): void => {
	const { client } = deps;
	server.registerTool(
		'list_catalogues',
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
				content: [{ type: 'text', text: `Available catalogues: ${catalogueIds.join(', ')}` }],
				structuredContent: { catalogues },
			};
		},
	);

	server.registerTool(
		'get_sqon_schema',
		{
			title: 'Get SQON Schema',
			description:
				'Returns a compact SQON quick reference (grammar, operators, and worked examples) for writing valid filters, plus the full machine-readable SQON JSON Schema and operator metadata in structuredContent.',
			outputSchema: sqonIntrospectionSchema,
		},
		async () => {
			const data = await client.getSqonIntrospection();
			const sqonSchema = sqonIntrospectionSchema.parse(data);
			return {
				content: [{ type: 'text', text: SQON_CHEAT_SHEET }],
				structuredContent: sqonSchema,
			};
		},
	);

	server.registerTool(
		'get_catalogue_fields',
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

	registerExecuteQueryTool(server, deps);
};
