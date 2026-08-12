import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, afterEach, suite, test } from 'node:test';

import express, { Router } from 'express';

import createIntrospectionRoutes from './index.js';

const openServers: Server[] = [];

const runOn = (router: Router) => {
	const app = express();
	app.use(router);
	const server = app.listen(0);
	openServers.push(server);
	const { port } = server.address() as AddressInfo;
	return `http://127.0.0.1:${port}`;
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

const fakeCatalogueRouter = (catalogueId: string) => {
	const router = Router();
	router.get('/introspection', (_req, res) => res.json({ catalogueId, reached: true }));
	return router;
};

suite('createIntrospectionRoutes: /introspection/:catalogueId identifier resolution', () => {
	test('accepts a real catalogueId, unchanged from today', async () => {
		const router = createIntrospectionRoutes({
			catalogs: { mutation: { documentType: 'records' } },
			catalogueRouters: { mutation: fakeCatalogueRouter('mutation') },
			catalogueStatuses: { mutation: { status: 'available' } },
		});

		const baseUrl = runOn(router);
		const response = await fetch(`${baseUrl}/introspection/mutation`);
		const body = (await response.json()) as Record<string, unknown>;

		assert.equal(response.status, 200);
		assert.equal(body.catalogueId, 'mutation');
	});

	test('resolves a documentType naming exactly one catalogue to its real catalogueId', async () => {
		const router = createIntrospectionRoutes({
			catalogs: {
				donor: { documentType: 'donor' },
				mutation: { documentType: 'records' },
			},
			catalogueRouters: {
				donor: fakeCatalogueRouter('donor'),
				mutation: fakeCatalogueRouter('mutation'),
			},
			catalogueStatuses: {
				donor: { status: 'available' },
				mutation: { status: 'available' },
			},
		});

		const baseUrl = runOn(router);
		const response = await fetch(`${baseUrl}/introspection/records`);
		const body = (await response.json()) as Record<string, unknown>;

		assert.equal(response.status, 200);
		assert.equal(body.catalogueId, 'mutation');
	});

	test('returns 409 with every matching catalogueId when the documentType is shared by several catalogues', async () => {
		const router = createIntrospectionRoutes({
			catalogs: {
				correlation: { documentType: 'records' },
				mutation: { documentType: 'records' },
			},
			catalogueRouters: {
				correlation: fakeCatalogueRouter('correlation'),
				mutation: fakeCatalogueRouter('mutation'),
			},
			catalogueStatuses: {
				correlation: { status: 'available' },
				mutation: { status: 'available' },
			},
		});

		const baseUrl = runOn(router);
		const response = await fetch(`${baseUrl}/introspection/records`);
		const body = (await response.json()) as Record<string, unknown>;

		assert.equal(response.status, 409);
		assert.equal(body.documentType, 'records');
		assert.equal((body.error as { code: string }).code, 'ambiguous_document_type');
		assert.deepEqual((body.matchingCatalogueIds as string[]).sort(), ['correlation', 'mutation']);
	});

	test('an identifier matching no catalogue at all still 404s, unaffected by the resolution logic', async () => {
		const router = createIntrospectionRoutes({
			catalogs: { donor: { documentType: 'donor' } },
			catalogueRouters: { donor: fakeCatalogueRouter('donor') },
			catalogueStatuses: { donor: { status: 'available' } },
		});

		const baseUrl = runOn(router);
		const response = await fetch(`${baseUrl}/introspection/nonexistent`);

		assert.equal(response.status, 404);
	});
});
