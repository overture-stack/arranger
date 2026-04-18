import { createArrangerIntrospectionClient } from '#arranger/client.js';
import { createArrangerMcpConfig } from '#config.js';
import { buildCatalogResources, buildStaticResources } from '#mcp/resources.js';
import { buildFoundationTools } from '#mcp/tools.js';

export interface ArrangerMcpFoundation {
	config: ReturnType<typeof createArrangerMcpConfig>;
	tools: ReturnType<typeof buildFoundationTools>;
	resources: ReturnType<typeof buildStaticResources>;
	loadCatalogResources(): Promise<ReturnType<typeof buildCatalogResources>>;
}

export const createArrangerMcpFoundation = (): ArrangerMcpFoundation => {
	const config = createArrangerMcpConfig();
	const client = createArrangerIntrospectionClient(config);

	return {
		config,
		resources: buildStaticResources(),
		tools: buildFoundationTools(),
		loadCatalogResources: async () => {
			const serverIntrospection = await client.getServerIntrospection();
			return buildCatalogResources(serverIntrospection);
		},
	};
};

/*
	The intended next step is roughly:

	1. create the MCP transport/server
	2. register static resources from `buildStaticResources()`
	3. register dynamic catalog resources after `getServerIntrospection()`
	4. implement tool handlers by calling:
	   - client.getServerIntrospection()
	   - client.getSqonIntrospection()
	   - client.getCatalogIntrospection(catalogId)
*/
