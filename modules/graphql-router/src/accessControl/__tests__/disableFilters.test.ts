import assert from 'node:assert';
import { suite, test } from 'node:test';

import type { RequestHandler } from 'express';

import accessControl from '#accessControl/index.js';

const runMiddleware = async ({
	middleware,
	req,
}: {
	middleware: RequestHandler;
	req: { body?: unknown; method?: string; query?: Record<string, unknown> };
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

	await new Promise<void>((resolve, reject) => {
		middleware(req as never, response as never, (err?: unknown) => {
			if (err) {
				reject(err);
				return;
			}

			nextCalled = true;
			resolve();
		});

		if (!nextCalled && response.statusCode !== 200) {
			resolve();
		}
	});

	return {
		nextCalled,
		response,
	};
};

suite('accessControl/disableFilters', () => {
	test('1.blocks requests with SQON filters when disableFilters is enabled', async () => {
		const middleware = accessControl({
			configs: {
				disableFilters: true,
			},
		});

		const result = await runMiddleware({
			middleware,
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
	});

	test('2.allows requests when disableFilters is disabled', async () => {
		const middleware = accessControl({
			configs: {
				disableFilters: false,
			},
		});

		const result = await runMiddleware({
			middleware,
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

		assert.equal(result.nextCalled, true);
		assert.equal(result.response.statusCode, 200);
	});

	test('3.blocks nested sqon variables passed through query params', async () => {
		const middleware = accessControl({
			configs: {
				disableFilters: true,
			},
		});

		const result = await runMiddleware({
			middleware,
			req: {
				query: {
					variables: JSON.stringify({
						input: {
							sqon: {
								content: [],
								op: 'and',
							},
						},
					}),
				},
			},
		});

		assert.equal(result.nextCalled, false);
		assert.equal(result.response.statusCode, 400);
	});
});
