import type { ArrangerServerIntrospection } from '#arranger/types.js';

import type { McpResourceDefinition } from './types.js';

export const buildStaticResources = (): McpResourceDefinition[] => [
	{
		description: 'Arranger-wide server summary and catalog inventory.',
		name: 'arranger_server_introspection',
		uri: 'arranger://introspection/server',
	},
	{
		description: 'Shared SQON schema and SQON operator metadata for this Arranger instance.',
		name: 'arranger_sqon_schema',
		uri: 'arranger://introspection/sqon',
	},
];

export const buildCatalogResources = (
	serverIntrospection: ArrangerServerIntrospection,
): McpResourceDefinition[] =>
	Object.keys(serverIntrospection.catalogs).map((catalogId) => ({
		description: `Field-level introspection for the "${catalogId}" catalog.`,
		name: `arranger_catalog_${catalogId}`,
		uri: `arranger://introspection/catalog/${catalogId}`,
	}));
