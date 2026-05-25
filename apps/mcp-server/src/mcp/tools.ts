import type { McpToolDefinition } from './types.js';

export const buildFoundationTools = (): McpToolDefinition[] => [
	{
		description: 'List the catalogs exposed by the connected Arranger server.',
		name: 'list_catalogs',
	},
	{
		description: 'Return the shared SQON schema and operator metadata for the connected Arranger server.',
		name: 'get_sqon_schema',
	},
	{
		description: 'Return field introspection for one catalog, including field names, field types, and valid operators.',
		inputSchema: {
			properties: {
				catalogId: {
					description: 'Catalog identifier from the Arranger /introspection payload.',
					type: 'string',
				},
			},
			required: ['catalogId'],
			type: 'object',
		},
		name: 'get_catalog_fields',
	},
];
