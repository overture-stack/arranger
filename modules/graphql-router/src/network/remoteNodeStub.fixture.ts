import { createServer } from 'node:net';
import { mock } from 'node:test';
import { format } from 'node:util';

import express, { type Response } from 'express';

import { serveOnLoopback } from '#loopbackServer.fixture.js';

/** A remote node a test serves locally: its GraphQL URL, and `close`, settling once the server has closed. */
export type RemoteNodeStub = { close: () => Promise<void>; url: string };

/**
 * Serves a remote node on a free loopback port, answering every GraphQL request through `answer`, which is given
 * the request's query text and the response to write.
 *
 * @param answer writes the remote node's answer.
 */
export const serveRemoteNode = async (answer: (query: string, response: Response) => void): Promise<RemoteNodeStub> => {
	const app = express()
		.use(express.json())
		.post('/graphql', (request, response) => answer(String(request.body?.query ?? ''), response));
	const { close, url } = await serveOnLoopback(app);

	return { close, url: `${url}/graphql` };
};

/**
 * Runs `exchange` with the URL of a remote node nothing answers at, then closes it: a loopback port that closes every
 * connection before a byte of answer. The port stays held for the whole exchange, so no other process can answer at
 * it.
 *
 * @param exchange given the node's URL; its result is returned once the port has closed.
 */
export const withUnreachableRemoteNode = async <Result>(
	exchange: (url: string) => Promise<Result>,
): Promise<Result> => {
	const server = createServer((socket) => socket.destroy());

	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => resolve());
	});

	const address = server.address();
	const port = typeof address === 'object' && address !== null ? address.port : undefined;

	try {
		if (port === undefined) {
			throw new Error('The unreachable remote node did not report its port.');
		}

		return await exchange(`http://127.0.0.1:${port}/graphql`);
	} finally {
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
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
