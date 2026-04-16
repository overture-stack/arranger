import assert from 'node:assert';
import { suite, test } from 'node:test';

import type { RequestHandler } from 'express';

import { createRequestPreprocessingMiddleware } from '#router.js';

const runMiddlewareChain = async ({
	middlewares,
	req,
}: {
	middlewares: RequestHandler[];
	req: { body?: unknown; context?: Record<string, unknown>; query?: Record<string, unknown> };
}) => {
	const response = {
		body: undefined as unknown,
		statusCode: 200,
		json(payload: unknown) {
			this.body = payload;
			return this;
		},
		status(code: number) {
			this.statusCode = code;
			return this;
		},
	};

	let nextCalled = false;

	const run = (index: number): Promise<void> =>
		new Promise<void>((resolve, reject) => {
			const middleware = middlewares[index];

			if (!middleware) {
				nextCalled = true;
				resolve();
				return;
			}

			middleware(req as never, response as never, (err?: unknown) => {
				if (err) {
					reject(err);
					return;
				}

				resolve(run(index + 1));
			});

			if (response.statusCode !== 200) {
				resolve();
			}
		});

	await run(0);

	return {
		nextCalled,
		req,
		response,
	};
};

suite('router middleware injection', () => {
	test('1.applies disableFilters through the router preprocessing stack', async () => {
		const middlewares = createRequestPreprocessingMiddleware({
			configs: {
				disableFilters: true,
			},
			enableDebug: true,
		});

		const result = await runMiddlewareChain({
			middlewares,
			req: {
				body: {
					variables: {
						filters: {
							content: [],
							op: 'and',
						},
					},
				},
				query: {},
			},
		});

		assert.equal(result.nextCalled, false);
		assert.equal(result.response.statusCode, 400);
		assert.deepEqual(result.response.body, {
			error: 'Filters are disabled for this server.',
		});
		assert.deepEqual(result.req.context, {
			enableDebug: true,
		});
	});
});
