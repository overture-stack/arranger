import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import express, { Router } from 'express';
import request from 'supertest';

import createIntrospectionRoutes from './index.js';

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

		const response = await request(express().use(router)).get('/introspection/mutation');

		assert.equal(response.status, 200);
		assert.equal(response.body.catalogueId, 'mutation');
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

		const response = await request(express().use(router)).get('/introspection/records');

		assert.equal(response.status, 200);
		assert.equal(response.body.catalogueId, 'mutation');
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

		const response = await request(express().use(router)).get('/introspection/records');

		assert.equal(response.status, 409);
		assert.equal(response.body.documentType, 'records');
		assert.equal(response.body.error.code, 'ambiguous_document_type');
		assert.deepEqual((response.body.matchingCatalogueIds as string[]).sort(), ['correlation', 'mutation']);
	});

	test('an identifier matching no catalogue at all still 404s, unaffected by the resolution logic', async () => {
		const router = createIntrospectionRoutes({
			catalogs: { donor: { documentType: 'donor' } },
			catalogueRouters: { donor: fakeCatalogueRouter('donor') },
			catalogueStatuses: { donor: { status: 'available' } },
		});

		const response = await request(express().use(router)).get('/introspection/nonexistent');

		assert.equal(response.status, 404);
	});
});
