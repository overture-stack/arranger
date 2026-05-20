import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';

import { createArrangerIntrospectionClient, type ArrangerIntrospectionClient } from '#arranger/client.js';
import { validateArrangerConnection } from '#arranger/validation.js';
import { createHttpApp } from '#http/app.js';
import { registerResources } from '#mcp/resources.js';
import { registerTools } from '#mcp/tools.js';
import { createArrangerMcpConfig, type ArrangerMcpConfig } from '#utils/config.js';
import logger from '#utils/logger.js';

export type McpServerDeps = {
	config: ArrangerMcpConfig;
	client: ArrangerIntrospectionClient;
};

export const createMcpServer = (deps: McpServerDeps): McpServer => {
	const server = new McpServer({ name: 'arranger-mcp-server', version: '0.0.0-dev' });
	registerResources(server, deps);
	registerTools(server, deps);
	return server;
};

export const startServer = async (): Promise<void> => {
	const config = createArrangerMcpConfig();
	const client = createArrangerIntrospectionClient(config);
	await validateArrangerConnection(config, client);

	const deps: McpServerDeps = { config, client };
	const { app, shutdown } = createHttpApp(config, () => createMcpServer(deps));

	const { host, port, path } = config.mcp;
	app.listen(port, () => {
		logger.info(`MCP server running at http://${host}:${port}${path}`);
	});

	process.on('SIGINT', async () => {
		logger.info('Shutting down server...');
		await shutdown();
		logger.info('Server shutdown complete.');
		process.exit(0);
	});
};
