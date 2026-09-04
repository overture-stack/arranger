import { type Server } from 'http';

import { createArrangerClient } from '../../../apps/mcp-server/src/arranger/client.js';
import { validateArrangerConnection } from '../../../apps/mcp-server/src/arranger/validation.js';
import { startMcpHttpServer } from '../../../apps/mcp-server/src/http/server.js';
import { createMcpServer } from '../../../apps/mcp-server/src/server.js';
import type { ArrangerMcpConfig } from '../../../apps/mcp-server/src/utils/config.js';

export type StartedMcpServer = {
	config: ArrangerMcpConfig;
	httpServer: Server;
	url: string;
	shutdown: () => Promise<void>;
};

/**
 * Starts the MCP server in-process for integration testing.
 *
 * Mirrors `startServer()` from `apps/mcp-server/src/server.ts`, but accepts a config object
 * directly (instead of reading `process.env`) and returns the http.Server so the test harness
 * can close it during teardown.
 *
 * Calling `validateArrangerConnection` here also serves as the "startup proves connectivity"
 * assertion: if the configured Arranger isn't reachable, this throws and the test fails.
 */
export const startMcpServerForTest = async (config: ArrangerMcpConfig): Promise<StartedMcpServer> => {
	const introspectionClient = createArrangerClient(config);

	await validateArrangerConnection(config, introspectionClient);

	const { httpServer, close } = await startMcpHttpServer(config, () =>
		createMcpServer({ config, client: introspectionClient }),
	);

	const { host, port, path } = config.mcp;

	return {
		config,
		httpServer,
		url: `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}${path}`,
		shutdown: close,
	};
};
