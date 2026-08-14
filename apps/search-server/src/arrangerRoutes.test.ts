import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import express, { Router } from 'express';
import request from 'supertest';

import arrangerRoutes, { buildCatalogueRouter } from './arrangerRoutes.js';

/** supertest requires a real Express app (or http.Server), not a bare Router: a Router's own internal fallthrough calls `next()`, which only resolves to a 404 when a real app supplies the default handler. */
const asApp = (router: Router) => express().use(router);

const fakeAvailableRouter = () => {
	const router = Router();
	router.get('/introspection', (_req, res) => res.json({ ok: true }));
	return router;
};

suite('arrangerRoutes', () => {
	test('throws when no catalogues are configured', async () => {
		await assert.rejects(arrangerRoutes({ catalogs: {}, enableDebug: false }), /No catalogues configured/);
	});

	test("forwards each catalogue's own key as catalogueId to buildCatalogueRouterFn", async () => {
		const receivedCatalogueIds: string[] = [];

		await arrangerRoutes({
			buildCatalogueRouterFn: async ({ catalogueId }) => {
				receivedCatalogueIds.push(catalogueId);
				return fakeAvailableRouter();
			},
			catalogs: {
				donor: { documentType: 'donor' },
				participant: { documentType: 'participant' },
			},
			enableDebug: false,
		});

		assert.deepEqual(receivedCatalogueIds.sort(), ['donor', 'participant']);
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

		const router = Router().use('/', (req, res, next) => {
			req.url = '/introspection';
			return catalogueRouters.broken?.(req, res, next);
		});

		const response = await request(asApp(router)).get('/anything');

		assert.equal(response.status, 200);
		assert.equal(response.body.catalogueId, 'broken');
		assert.equal(response.body.status, 'failed');
		assert.equal(response.body.error?.code, 'unknown_error');
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

		const router = Router().use('/', (req, res, next) => {
			req.url = '/introspection';
			return catalogueRouters.broken?.(req, res, next);
		});

		const response = await request(asApp(router)).get('/anything');

		assert.equal(response.body.documentType, 'widget');
		assert.equal(response.body.description, 'A catalogue that never comes up.');
	});

	test("a failed catalogue's description is omitted when not configured, same as an available catalogue", async () => {
		const { catalogueRouters } = await arrangerRoutes({
			buildCatalogueRouterFn: async () => {
				throw new Error('boom');
			},
			catalogs: { broken: { documentType: 'widget' } },
			enableDebug: false,
		});

		const router = Router().use('/', (req, res, next) => {
			req.url = '/introspection';
			return catalogueRouters.broken?.(req, res, next);
		});

		const response = await request(asApp(router)).get('/anything');

		assert.equal('description' in response.body, false);
	});

	test("a failed catalogue's other paths (e.g. graphql) return 404 with a pointer to its introspection endpoint", async () => {
		const { catalogueRouters } = await arrangerRoutes({
			buildCatalogueRouterFn: async () => {
				throw new Error('boom');
			},
			catalogs: { broken: { documentType: 'broken' } },
			enableDebug: false,
		});

		const response = await request(asApp(catalogueRouters.broken as Router)).post('/graphql');

		assert.equal(response.status, 404);
		assert.equal(response.body.status, 'failed');
		assert.equal(response.body.details, '/introspection/broken');
	});

	test('the real buildCatalogueRouter is used by default when no override is provided', () => {
		assert.equal(typeof buildCatalogueRouter, 'function');
	});

	const fakeRouterReporting = (catalogueId: string) => {
		const router = Router();
		router.all(/.*/, (req, res) => res.json({ catalogueId, path: req.path }));
		return router;
	};

	test('a documentType naming exactly one catalogue is resolved to the real catalogueId in the request path', async () => {
		const { router } = await arrangerRoutes({
			buildCatalogueRouterFn: async ({ catalogueId }) => fakeRouterReporting(catalogueId),
			catalogs: {
				donor: { documentType: 'donor' },
				mutation: { documentType: 'records' },
			},
			enableDebug: false,
		});

		const response = await request(asApp(router)).post('/records/graphql');

		assert.equal(response.status, 200);
		assert.equal(response.body.catalogueId, 'mutation');
		assert.equal(response.body.path, '/graphql');
	});

	test('a literal catalogueId is left unrewritten even when the same string could also be read as a documentType', async () => {
		const { router } = await arrangerRoutes({
			buildCatalogueRouterFn: async ({ catalogueId }) => fakeRouterReporting(catalogueId),
			catalogs: {
				donor: { documentType: 'records' },
				records: { documentType: 'donor' },
			},
			enableDebug: false,
		});

		const response = await request(asApp(router)).post('/records/graphql');

		assert.equal(response.body.catalogueId, 'records');
	});

	test('a documentType shared by several catalogues returns 409 instead of silently picking one', async () => {
		const { router } = await arrangerRoutes({
			buildCatalogueRouterFn: async ({ catalogueId }) => fakeRouterReporting(catalogueId),
			catalogs: {
				correlation: { documentType: 'records' },
				mutation: { documentType: 'records' },
			},
			enableDebug: false,
		});

		const response = await request(asApp(router)).post('/records/graphql');

		assert.equal(response.status, 409);
		assert.equal(response.body.documentType, 'records');
		assert.equal(response.body.error.code, 'ambiguous_document_type');
		assert.deepEqual((response.body.matchingCatalogueIds as string[]).sort(), ['correlation', 'mutation']);
	});

	test('an identifier matching no catalogue at all still 404s, unaffected by the resolution logic', async () => {
		const { router } = await arrangerRoutes({
			buildCatalogueRouterFn: async ({ catalogueId }) => fakeRouterReporting(catalogueId),
			catalogs: {
				donor: { documentType: 'donor' },
				mutation: { documentType: 'records' },
			},
			enableDebug: false,
		});

		const response = await request(asApp(router)).post('/nonexistent/graphql');

		assert.equal(response.status, 404);
	});

	test('a query string surviving a documentType-to-catalogueId rewrite reaches the catalogue router intact', async () => {
		const fakeQueryReportingRouter = Router();
		fakeQueryReportingRouter.all(/.*/, (req, res) => res.json({ query: req.query }));

		const { router } = await arrangerRoutes({
			buildCatalogueRouterFn: async () => fakeQueryReportingRouter,
			catalogs: { mutation: { documentType: 'records' } },
			enableDebug: false,
		});

		const response = await request(asApp(router)).post('/records/graphql').query({ foo: 'bar' });

		assert.deepEqual(response.body.query, { foo: 'bar' });
	});
});
