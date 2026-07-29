import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, afterEach, suite, test } from 'node:test';

import express, { Router } from 'express';

import arrangerRoutes, { buildCatalogueRouter } from './arrangerRoutes.js';

const startServer = (router: Router) => {
	const app = express();
	app.use(router);
	const server = app.listen(0);
	const { port } = server.address() as AddressInfo;
	return { baseUrl: `http://127.0.0.1:${port}`, server };
};

const openServers: ReturnType<typeof startServer>['server'][] = [];

const runOn = (router: Router) => {
	const { baseUrl, server } = startServer(router);
	openServers.push(server);
	return baseUrl;
};

afterEach(() => {
	while (openServers.length) {
		openServers.pop()?.close();
	}
});

after(() => {
	while (openServers.length) {
		openServers.pop()?.close();
	}
});

const fakeAvailableRouter = () => {
	const router = Router();
	router.get('/introspection', (_req, res) => res.json({ ok: true }));
	return router;
};

suite('arrangerRoutes', () => {
	test('throws when no catalogues are configured', async () => {
		await assert.rejects(
			arrangerRoutes({ catalogs: {}, enableDebug: false }),
			/No catalogues configured/,
		);
	});

	test('one catalogue failing to build does not prevent the others from becoming available', async () => {
		const result = await arrangerRoutes({
			buildCatalogueRouterFn: async ({ catalogueConfigs }) => {
				if (catalogueConfigs.documentType === 'broken') {
					throw new Error('Could not create a mapping', {
						cause: Object.assign(new Error('not found'), { name: 'ResponseError', statusCode: 404 }),
					});
				}
				return fakeAvailableRouter();
			},
			catalogs: {
				broken: { documentType: 'broken' },
				healthy: { documentType: 'healthy' },
			},
			enableDebug: false,
		});

		assert.deepEqual(result.catalogueStatuses.healthy, { status: 'available' });
		assert.equal(result.catalogueStatuses.broken?.status, 'failed');
		assert.equal(
			result.catalogueStatuses.broken?.status === 'failed' && result.catalogueStatuses.broken.error.code,
			'index_not_found',
		);
	});

	test("a failed catalogue's introspection endpoint reports its status with a 200, not a crash", async () => {
		const { catalogueRouters } = await arrangerRoutes({
			buildCatalogueRouterFn: async ({ catalogueConfigs }) => {
				if (catalogueConfigs.documentType === 'broken') {
					throw new Error('boom');
				}
				return fakeAvailableRouter();
			},
			catalogs: { broken: { documentType: 'broken' }, healthy: { documentType: 'healthy' } },
			enableDebug: false,
		});

		const baseUrl = runOn(Router().use('/', (req, res, next) => {
			req.url = '/introspection';
			return catalogueRouters.broken?.(req, res, next);
		}));

		const response = await fetch(`${baseUrl}/anything`);
		const body = (await response.json()) as Record<string, unknown>;

		assert.equal(response.status, 200);
		assert.equal(body.catalogueId, 'broken');
		assert.equal(body.status, 'failed');
		assert.equal((body.error as { code: string })?.code, 'unknown_error');
	});

	test("a failed catalogue's status carries its documentType and description from config, same as the server-wide listing would show", async () => {
		const { catalogueRouters } = await arrangerRoutes({
			buildCatalogueRouterFn: async () => {
				throw new Error('boom');
			},
			catalogs: {
				broken: { description: 'A catalogue that never comes up.', documentType: 'widget' },
			},
			enableDebug: false,
		});

		const baseUrl = runOn(
			Router().use('/', (req, res, next) => {
				req.url = '/introspection';
				return catalogueRouters.broken?.(req, res, next);
			}),
		);

		const response = await fetch(`${baseUrl}/anything`);
		const body = (await response.json()) as Record<string, unknown>;

		assert.equal(body.documentType, 'widget');
		assert.equal(body.description, 'A catalogue that never comes up.');
	});

	test("a failed catalogue's description is omitted when not configured, same as an available catalogue", async () => {
		const { catalogueRouters } = await arrangerRoutes({
			buildCatalogueRouterFn: async () => {
				throw new Error('boom');
			},
			catalogs: { broken: { documentType: 'widget' } },
			enableDebug: false,
		});

		const baseUrl = runOn(
			Router().use('/', (req, res, next) => {
				req.url = '/introspection';
				return catalogueRouters.broken?.(req, res, next);
			}),
		);

		const response = await fetch(`${baseUrl}/anything`);
		const body = (await response.json()) as Record<string, unknown>;

		assert.equal('description' in body, false);
	});

	test("a failed catalogue's other paths (e.g. graphql) return 404 with a pointer to its introspection endpoint", async () => {
		const { catalogueRouters } = await arrangerRoutes({
			buildCatalogueRouterFn: async () => {
				throw new Error('boom');
			},
			catalogs: { broken: { documentType: 'broken' } },
			enableDebug: false,
		});

		const baseUrl = runOn(catalogueRouters.broken as Router);
		const response = await fetch(`${baseUrl}/graphql`, { method: 'POST' });
		const body = (await response.json()) as Record<string, unknown>;

		assert.equal(response.status, 404);
		assert.equal(body.status, 'failed');
		assert.equal(body.details, '/introspection/broken');
	});

	test('the real buildCatalogueRouter is used by default when no override is provided', () => {
		assert.equal(typeof buildCatalogueRouter, 'function');
	});
});
