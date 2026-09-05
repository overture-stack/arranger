import { McpServer, type RequestStateCodec } from '@modelcontextprotocol/server';

import { createArrangerClient, type ArrangerClient } from '#arranger/client.js';
import { validateArrangerConnection } from '#arranger/validation.js';
import { startMcpHttpServer } from '#http/server.js';
import { SERVER_INSTRUCTIONS } from '#mcp/instructions.js';
import { registerPrompts } from '#mcp/prompts.js';
import { createConfirmationCodec, type ConfirmationState } from '#mcp/requestState.js';
import { registerResources } from '#mcp/resources.js';
import { registerTools } from '#mcp/tools.js';
import { createArrangerMcpConfig, type ArrangerMcpConfig } from '#utils/config.js';
import logger from '#utils/logger.js';

export type McpServerDeps = {
	config: ArrangerMcpConfig;
	client: ArrangerClient;
	/** Signs and verifies `execute_query`'s confirmation state. Built once per process, not per request. */
	requestStateCodec: RequestStateCodec<ConfirmationState>;
};

export const createMcpServer = (deps: McpServerDeps): McpServer => {
	const server = new McpServer(
		{ name: 'arranger-mcp-server', version: '0.0.0-dev' },
		{
			instructions: SERVER_INSTRUCTIONS,
			// Refuses a forged, expired or wrongly bound state before any handler runs, and decodes a
			// good one for `ctx.mcpReq.requestState()` to read.
			requestState: { verify: deps.requestStateCodec.verify },
		},
	);
	registerResources(server, deps);
	registerTools(server, deps);
	registerPrompts(server, deps);
	return server;
};

export const startServer = async (): Promise<void> => {
	const config = createArrangerMcpConfig();
	const client = createArrangerClient(config);
	await validateArrangerConnection(config, client);

	const deps: McpServerDeps = { config, client, requestStateCodec: createConfirmationCodec(config) };
	// One instance per request: the handler serves each request independently, so nothing is held
	// between them and there is no session map to reap on shutdown.
	const { close } = await startMcpHttpServer(config, () => createMcpServer(deps));

	const { host, port, path } = config.mcp;
	logger.info(`MCP server running at http://${host}:${port}${path}`);

	const gracefulShutdown = async (signal: string) => {
		logger.info(`Received ${signal}, initiating graceful shutdown...`);

		// Force shutdown fallback after 30 seconds
		const hardShutdownTimeout = setTimeout(() => {
			logger.error('Graceful shutdown timed out, forcing exit');
			process.exit(1);
		}, 30000);

		hardShutdownTimeout.unref(); // Allow process to exit if this is the only thing left

		try {
			await close();
			logger.info('Graceful shutdown complete, exiting now.');
			process.exit(0);
		} catch (error) {
			logger.error({ error }, 'Error during graceful shutdown, forcing exit');
			process.exit(1);
		}
	};

	process.on('SIGINT', () => gracefulShutdown('SIGINT'));
	process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
};
