import http, { type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import { hostHeaderValidation, originValidation, toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler, type McpServerFactory } from '@modelcontextprotocol/server';

import { readCappedJsonBody } from '#http/requestBody.js';
import { type ArrangerMcpConfig } from '#utils/config.js';
import logger from '#utils/logger.js';

export type McpHttpServer = {
	httpServer: Server;
	/** Tears down the MCP handler and then stops accepting connections. */
	close: () => Promise<void>;
};

/** Guards answer the request themselves when they refuse, and report whether serving may continue. */
type RequestGuard = (req: IncomingMessage, res: ServerResponse) => boolean;

const writeJsonRpcError = (res: ServerResponse, status: number, code: number, message: string): void => {
	res.writeHead(status, { 'Content-Type': 'application/json' });
	res.end(JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null }));
};

/**
 * Builds the DNS rebinding guards from configuration.
 *
 * The Host guard is omitted only for `MCP_ALLOWED_HOSTS=*`, which is the operator asserting that an
 * upstream gateway validates the header. The Origin guard is always installed: an empty allowlist is
 * a live check that passes requests carrying no `Origin` (every non-browser MCP client) and rejects
 * any browser origin.
 */
const createGuards = ({ allowedHosts, allowedOrigins }: ArrangerMcpConfig['mcp']): RequestGuard[] => {
	const guards: RequestGuard[] = [];
	if (allowedHosts === 'any') {
		logger.warn('MCP_ALLOWED_HOSTS is "*": Host header validation is delegated to an upstream gateway.');
	} else {
		guards.push(hostHeaderValidation(allowedHosts));
	}
	guards.push(originValidation(allowedOrigins));
	return guards;
};

/**
 * Starts the MCP server over Streamable HTTP on plain `node:http`.
 *
 * `createMcpHandler` returns a web-standard `{ fetch, close, notify, bus }`, and `toNodeHandler`
 * bridges it to `(req, res, parsedBody)`. There is no framework in between: the SDK ships the Host
 * and Origin guards as `node:http` guards, and the only thing Express was contributing was
 * `express.json({ limit })`, which `readCappedJsonBody` replaces.
 *
 * `legacy: 'reject'` serves protocol revision `2026-07-28` only. A 2025-era client is answered with
 * an unsupported-protocol-version error naming the revision this endpoint speaks, rather than served
 * a degraded session: per-request legacy serving cannot receive server-to-client requests, so
 * `execute_query` could not obtain its confirmation on that path.
 *
 * @param config - Validated server configuration.
 * @param serverFactory - Produces a fresh `McpServer` for each request the handler serves.
 * @returns The listening server and a shutdown function.
 */
export const startMcpHttpServer = async (
	config: ArrangerMcpConfig,
	serverFactory: McpServerFactory,
): Promise<McpHttpServer> => {
	const { host, port, path, maxBodyBytes } = config.mcp;

	const handler = createMcpHandler(serverFactory, {
		legacy: 'reject',
		// Reporting only: the handler has already answered. The common case here is a 2025-era
		// client being turned away, which is expected traffic rather than a fault of ours, so this
		// is a warning. Genuine handler failures surface in the response either way.
		onerror: (err) => logger.warn({ err }, 'MCP handler rejected or reported a request'),
	});
	const serve = toNodeHandler(handler, {
		onerror: (err) => logger.error({ err }, 'MCP transport adapter error'),
	});
	const guards = createGuards(config.mcp);

	const httpServer = http.createServer((req, res) => {
		void (async () => {
			try {
				// Before anything reads the body: a refused request should never cost us the payload.
				for (const guard of guards) {
					if (!guard(req, res)) {
						return;
					}
				}

				const { pathname } = new URL(req.url ?? '/', `http://${host}`);
				if (pathname !== path) {
					writeJsonRpcError(res, 404, -32601, `Not found. The MCP endpoint is ${path}.`);
					return;
				}

				const { body, refusal } = await readCappedJsonBody(req, maxBodyBytes);
				if (refusal) {
					writeJsonRpcError(res, refusal.status, refusal.code, refusal.message);
					return;
				}

				await serve(req, res, body);
			} catch (error) {
				logger.error({ err: error }, 'Unhandled error serving MCP request');
				if (!res.headersSent) {
					writeJsonRpcError(res, 500, -32603, 'Internal server error');
				}
				res.end();
			}
		})();
	});

	await new Promise<void>((resolve, reject) => {
		httpServer.once('error', reject);
		httpServer.listen(port, host, () => {
			httpServer.removeListener('error', reject);
			resolve();
		});
	});

	const close = async () => {
		await handler.close();
		await new Promise<void>((resolve, reject) => {
			httpServer.close((error) => (error ? reject(error) : resolve()));
		});
	};

	return { httpServer, close };
};
