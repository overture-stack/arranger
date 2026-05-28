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
		description:
			'Return field introspection for one catalogue. `operators` maps each field type to its valid SQON operators. `fields` lists each field with its `type`, `displayName`, optional `unit`, and optional `description`.',
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
