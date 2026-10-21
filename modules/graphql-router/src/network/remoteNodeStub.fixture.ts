import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { mock } from 'node:test';
import { format } from 'node:util';

import express, { type Response } from 'express';

/** A remote node a test serves locally: its GraphQL URL, and `close`, settling once the server has closed. */
export type RemoteNodeStub = { close: () => Promise<void>; url: string };

/**
 * Serves a remote node on a free local port, answering every GraphQL request through `answer`, which is given the
 * request's query text and the response to write. Bound to every address, as supertest binds its servers, so no
 * other server in the process can be given the same port.
 *
 * @param answer writes the remote node's answer.
 */
export const serveRemoteNode = async (answer: (query: string, response: Response) => void): Promise<RemoteNodeStub> => {
	const app = express()
		.use(express.json())
		.post('/graphql', (request, response) => answer(String(request.body?.query ?? ''), response));
	const server = app.listen(0);
	await once(server, 'listening');

	return {
		close: () =>
			new Promise((resolve) => {
				server.closeAllConnections();
				server.close(() => resolve());
			}),
		url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/graphql`,
	};
};

/** The URL of a remote node nothing answers at: a port served once and closed again. */
export const unreachableRemoteNodeUrl = async (): Promise<string> => {
	const stub = await serveRemoteNode((_query, response) => response.end());
	await stub.close();

	return stub.url;
};

/**
 * An answer to the schema query a GraphQL router sends a remote node at startup, holding one aggregation field. That
 * query is the one whose text holds `__type(`.
 */
export const SCHEMA_ANSWER = {
	data: {
		__type: { fields: [{ name: 'study', type: { name: 'Aggregations' } }], name: 'donorAggregations' },
	},
};

const CONSOLE_METHODS = ['debug', 'error', 'info', 'log', 'warn'] as const;

/** Runs `work` with console output captured, returning what it wrote, one line per call. */
export const withConsoleLines = async <Result>(
	work: () => Promise<Result>,
): Promise<{ lines: string[]; result: Result }> => {
	const lines: string[] = [];
	const mocks = CONSOLE_METHODS.map((method) =>
		mock.method(console, method, (...args: unknown[]) => {
			lines.push(format(...args));
		}),
	);

	try {
		return { lines, result: await work() };
	} finally {
		mocks.forEach((mocked) => mocked.mock.restore());
	}
};
