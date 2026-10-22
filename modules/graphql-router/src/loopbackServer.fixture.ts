import { once } from 'node:events';
import { createServer, type RequestListener, type Server } from 'node:http';

import supertest from 'supertest';

const LOOPBACK_ADDRESS = '127.0.0.1';

/**
 * A server a test serves on the loopback interface. `request` is a supertest client bound to it, sending each
 * request afresh with no cookies kept, `url` its base URL with no trailing slash, and `close` settles once the
 * server and every connection to it have closed.
 */
export type LoopbackServer = {
	close: () => Promise<void>;
	request: ReturnType<typeof supertest>;
	server: Server;
	url: string;
};

const portOf = (server: Server): number => {
	const address = server.address();

	if (typeof address === 'object' && address !== null) {
		return address.port;
	}

	throw new Error('A loopback test server listens on a TCP port, so its address should name one.');
};

/**
 * Serves `app` on 127.0.0.1 at a port the system picks, resolving once it listens. Bound to the address its client
 * connects to, the server is given a port no other listener holds there; one bound to every address can share its
 * port number with another process's loopback listener, which then answers in its place.
 *
 * @param app the request handler to serve, such as an Express app.
 */
export const serveOnLoopback = async (app: RequestListener): Promise<LoopbackServer> => {
	const server = createServer(app).listen(0, LOOPBACK_ADDRESS);
	await once(server, 'listening');

	return {
		close: () =>
			new Promise((resolve, reject) => {
				server.close((error) => (error ? reject(error) : resolve()));
				server.closeAllConnections();
			}),
		request: supertest(server),
		server,
		url: `http://${LOOPBACK_ADDRESS}:${portOf(server)}`,
	};
};

/**
 * Serves `app` on the loopback interface for one exchange: runs `exchange` with a supertest client bound to the
 * server, and closes the server once the exchange has settled, whether it succeeded or failed.
 *
 * @param app the request handler to serve, such as an Express app.
 * @param exchange sends the requests, returning what they settle to.
 */
export const withLoopbackServer = async <Result>(
	app: RequestListener,
	exchange: (request: LoopbackServer['request']) => PromiseLike<Result>,
): Promise<Result> => {
	const served = await serveOnLoopback(app);

	try {
		return await exchange(served.request);
	} finally {
		await served.close();
	}
};
