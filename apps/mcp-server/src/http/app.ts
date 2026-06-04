import { randomUUID } from 'node:crypto';

import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express';
import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types';
import { type Express, type Request, type Response } from 'express';

import { type ArrangerMcpConfig } from '#utils/config.js';
import { InMemoryEventStore } from '#utils/inMemoryEventStore.js';
import logger from '#utils/logger.js';

export type McpHttpApp = {
	app: Express;
	closeAllSessions: () => Promise<void>;
};

// This code was adapted from the official MCP Server "Streamable HTTP" example:
// https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.x/src/examples/server/simpleStreamableHttp.ts
export const createHttpApp = (config: ArrangerMcpConfig, serverFactory: () => McpServer): McpHttpApp => {
	const transports: Record<string, StreamableHTTPServerTransport> = {};

	const postHandler = async (req: Request, res: Response) => {
		const sessionId = req.headers['mcp-session-id'] as string | undefined;
		try {
			let transport: StreamableHTTPServerTransport;
			if (sessionId && transports[sessionId]) {
				transport = transports[sessionId];
			} else if (!sessionId && isInitializeRequest(req.body)) {
				transport = new StreamableHTTPServerTransport({
					sessionIdGenerator: () => randomUUID(),
					eventStore: new InMemoryEventStore(),
					onsessioninitialized: (sid) => {
						logger.info(`Session initialized with ID: ${sid}`);
						transports[sid] = transport;
					},
				});
				transport.onclose = () => {
					const sid = transport.sessionId;
					if (sid && transports[sid]) {
						logger.info(`Transport closed for session ${sid}, removing from transports map`);
						// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
						delete transports[sid];
					}
				};

				await serverFactory().connect(transport);
				await transport.handleRequest(req, res, req.body);
				return;
			} else {
				res.status(400).json({
					jsonrpc: '2.0',
					error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
					id: null,
				});
				return;
			}
			await transport.handleRequest(req, res, req.body);
		} catch (error) {
			logger.error({ error }, 'Error handling MCP POST');
			if (!res.headersSent) {
				res.status(500).json({
					jsonrpc: '2.0',
					error: { code: -32603, message: 'Internal server error' },
					id: null,
				});
			}
		}
	};

	const sessionHandler = async (req: Request, res: Response) => {
		const sessionId = req.headers['mcp-session-id'] as string | undefined;
		if (!sessionId || !transports[sessionId]) {
			res.status(400).send('Invalid or missing session ID');
			return;
		}
		await transports[sessionId].handleRequest(req, res);
	};

	const app = createMcpExpressApp();
	const {
		mcp: { path },
	} = config;
	app.post(path, postHandler);
	app.get(path, sessionHandler);
	app.delete(path, sessionHandler);

	const closeAllSessions = async () => {
		for (const sessionId of Object.keys(transports)) {
			try {
				logger.debug(`Closing transport for session ${sessionId}`);
				await transports[sessionId].close();
			} catch (error) {
				logger.error({ error, sessionId }, 'Error closing transport');
			}
			// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
			delete transports[sessionId];
		}
	};

	return { app, closeAllSessions };
};
