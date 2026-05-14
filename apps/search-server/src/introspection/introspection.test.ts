import assert from 'node:assert';
import { suite, test } from 'node:test';

import buildCatalogDetails from '#introspection/catalogDetails.js';
import buildBaseIntrospection from '#introspection/serverDetails.js';
import buildSqonIntrospection from '#introspection/sqonDetails.js';

suite('introspection tests', () => {
	test('builds a single-catalog payload with root graphql path', () => {
		const result = buildBaseIntrospection({
			catalogs: {
				models: {
					documentType: 'model',
				},
			},
		});

		assert.equal(result.mode, 'single');
		assert.equal(result.catalogCount, 1);
		assert.deepEqual(result.catalogs, {
			models: {
				documentType: 'model',
				paths: {
					fields: '/introspection/fields',
					graphql: '/graphql',
					introspection: '/introspection/models',
				},
			},
		});
		assert.equal(result.sqonSchemaPath, '/introspection/sqon');
	});

	test('builds a multi-catalog payload with catalog-scoped graphql paths', () => {
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
			},
			imaging: {
				documentType: 'file',
				paths: {
					graphql: '/imaging/graphql',
					introspection: '/introspection/imaging',
				},
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

	test('builds catalog field details from extended mapping configs', () => {
		const result = buildCatalogDetails({
			catalogId: 'models',
			catalogs: {
				models: {
					documentType: 'model',
					extended: [
						{
							displayName: 'Analysis State',
							displayType: 'keyword',
							displayValues: {},
							fieldName: 'analysis.state',
							isActive: true,
							isArray: false,
							primaryKey: false,
							quickSearchEnabled: true,
							rangeStep: 0,
							type: 'keyword',
							unit: null,
						},
						{
							displayName: 'Donor Age',
							displayType: 'number',
							displayValues: {},
							fieldName: 'donor.age',
							isActive: true,
							isArray: false,
							primaryKey: false,
							quickSearchEnabled: false,
							rangeStep: 1,
							type: 'long',
							unit: 'year',
						},
					],
				},
			},
			generatedAt: '2026-02-23T00:00:00Z',
		});

		assert.deepEqual(result, {
			catalogId: 'models',
			documentType: 'model',
			fields: {
				'analysis.state': {
					displayName: 'Analysis State',
					type: 'keyword',
					unit: null,
					validOperators: ['in', 'not-in', 'some-not-in', 'all', 'filter'],
				},
				'donor.age': {
					displayName: 'Donor Age',
					type: 'long',
					unit: 'year',
					validOperators: ['in', 'not-in', 'gt', 'gte', 'lt', 'lte', 'between'],
				},
			},
			generatedAt: '2026-02-23T00:00:00Z',
			meta: {
				authFiltered: false,
			},
		});
	});
});
