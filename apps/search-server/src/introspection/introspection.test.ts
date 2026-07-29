import assert from 'node:assert';
import { suite, test } from 'node:test';

import buildBaseIntrospection from '#introspection/serverDetails.js';
import buildSqonIntrospection from '#introspection/sqonDetails.js';

suite('introspection tests', () => {
	test('builds a single-catalogue payload with root graphql path', () => {
		const result = buildBaseIntrospection({
			catalogs: {
				models: {
					documentType: 'model',
				},
			},
		});

		assert.equal(result.mode, 'single');
		assert.equal(result.catalogCount, 1);
		assert.equal(result.status, 'healthy');
		assert.deepEqual(result.catalogs, {
			models: {
				documentType: 'model',
				paths: {
					fields: '/introspection/fields',
					graphql: '/graphql',
					introspection: '/introspection/models',
				},
				status: 'available',
			},
		});
		assert.equal(result.sqonSchemaPath, '/introspection/sqon');
	});

	test('builds a multi-catalogue payload with catalogue-scoped graphql paths', () => {
		const result = buildBaseIntrospection({
			catalogs: {
				chemistry: {
					documentType: 'file',
				},
				imaging: {
					documentType: 'file',
				},
			},
		});

		assert.equal(result.mode, 'multiple');
		assert.equal(result.catalogCount, 2);
		assert.deepEqual(result.catalogs, {
			chemistry: {
				documentType: 'file',
				paths: {
					graphql: '/chemistry/graphql',
					introspection: '/introspection/chemistry',
				},
				status: 'available',
			},
			imaging: {
				documentType: 'file',
				paths: {
					graphql: '/imaging/graphql',
					introspection: '/introspection/imaging',
				},
				status: 'available',
			},
		});
	});

	test('builds the dedicated sqon introspection payload', () => {
		const result = buildSqonIntrospection();

		assert.equal(typeof result.version, 'string');
		assert.deepEqual(result.aliases['>='], 'gte');
		assert.deepEqual(result.operators.combination, ['and', 'or', 'not']);
		assert.ok(Array.isArray(result.operators.field));
		assert.equal(result.schema.$ref, '#/$defs/SQON');
		assert.ok(result.schema.$defs.SQON);
		assert.ok(result.schema.$defs.Group);
	});

	test('includes description in root introspection when configured', () => {
		const result = buildBaseIntrospection({
			catalogs: {
				models: {
					documentType: 'model',
					description: 'Clinical trial participant models.',
				},
			},
		});

		const entry = result.catalogs['models'];
		assert.ok(entry !== undefined);
		assert.equal(entry.description, 'Clinical trial participant models.');
	});

	test('omits description key from root introspection when not configured', () => {
		const result = buildBaseIntrospection({
			catalogs: {
				models: {
					documentType: 'model',
				},
			},
		});

		const entry = result.catalogs['models'];
		assert.ok(entry !== undefined);
		assert.ok(!('description' in entry));
	});

	test('includes a failed catalogue in the listing with its error code and message, not just the available ones', () => {
		const result = buildBaseIntrospection({
			catalogs: {
				broken: { documentType: 'file' },
				healthy: { documentType: 'file' },
			},
			catalogueStatuses: {
				broken: {
					status: 'failed',
					error: { code: 'index_not_found', message: 'The configured search index could not be found.' },
				},
				healthy: { status: 'available' },
			},
		});

		assert.equal(result.catalogCount, 2);
		assert.equal(result.status, 'degraded');
		assert.equal(result.catalogs.broken?.status, 'failed');
		assert.equal(result.catalogs.broken?.error?.code, 'index_not_found');
		assert.equal(result.catalogs.broken?.error?.message, 'The configured search index could not be found.');
		assert.equal(result.catalogs.healthy?.status, 'available');
		assert.equal('error' in (result.catalogs.healthy ?? {}), false);
	});

	test('reports unhealthy when every catalogue has failed', () => {
		const result = buildBaseIntrospection({
			catalogs: {
				broken: { documentType: 'file' },
			},
			catalogueStatuses: {
				broken: {
					status: 'failed',
					error: { code: 'connection_error', message: 'Could not connect to the search engine.' },
				},
			},
		});

		assert.equal(result.status, 'unhealthy');
	});
});
