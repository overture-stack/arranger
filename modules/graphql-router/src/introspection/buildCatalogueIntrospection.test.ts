import assert from 'node:assert';
import { suite, test } from 'node:test';

import { buildCatalogueIntrospectionBody } from './buildCatalogueIntrospection.js';

const RESOLVED_FIELDS = [
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
	{
		displayName: 'Collection Date',
		displayType: 'date',
		displayValues: {},
		fieldName: 'collection.date',
		isActive: false,
		isArray: false,
		primaryKey: false,
		quickSearchEnabled: false,
		rangeStep: 0,
		type: 'date',
		unit: null,
	},
	// Field from the ES mapping that would not appear in raw config data
	{
		displayName: 'Is Published',
		displayType: 'boolean',
		displayValues: {},
		fieldName: 'is_published',
		isActive: false,
		isArray: false,
		primaryKey: false,
		quickSearchEnabled: false,
		rangeStep: 0,
		type: 'boolean',
		unit: undefined,
	},
];

suite('buildCatalogueIntrospectionBody', () => {
	test('returns correct catalogId and documentType', () => {
		const result = buildCatalogueIntrospectionBody({
			catalogId: 'models',
			documentType: 'model',
			resolvedFields: [],
		});

		assert.equal(result.catalogId, 'models');
		assert.equal(result.documentType, 'model');
	});

	test('sets generatedAt to an ISO timestamp', () => {
		const result = buildCatalogueIntrospectionBody({
			catalogId: 'models',
			documentType: 'model',
			resolvedFields: [],
		});

		assert.ok(typeof result.generatedAt === 'string');
		assert.ok(!Number.isNaN(Date.parse(result.generatedAt)));
	});

	test('sets meta.authFiltered to false', () => {
		const result = buildCatalogueIntrospectionBody({
			catalogId: 'models',
			documentType: 'model',
			resolvedFields: [],
		});

		assert.equal(result.meta.authFiltered, false);
	});

	test('includes description when provided', () => {
		const result = buildCatalogueIntrospectionBody({
			catalogId: 'models',
			description: 'Clinical trial participant models.',
			documentType: 'model',
			resolvedFields: [],
		});

		assert.equal(result.description, 'Clinical trial participant models.');
	});

	test('omits description key when not provided', () => {
		const result = buildCatalogueIntrospectionBody({
			catalogId: 'models',
			documentType: 'model',
			resolvedFields: [],
		});

		assert.ok(!('description' in result));
	});

	test('builds fields with correct displayName, type, and unit', () => {
		const result = buildCatalogueIntrospectionBody({
			catalogId: 'models',
			documentType: 'model',
			resolvedFields: RESOLVED_FIELDS,
		});

		assert.deepEqual(result.fields['analysis.state'], {
			displayName: 'Analysis State',
			type: 'keyword',
			unit: null,
		});

		assert.deepEqual(result.fields['donor.age'], {
			displayName: 'Donor Age',
			type: 'long',
			unit: 'year',
		});
	});

	test('builds operators keyed by field type', () => {
		const result = buildCatalogueIntrospectionBody({
			catalogId: 'models',
			documentType: 'model',
			resolvedFields: RESOLVED_FIELDS,
		});

		assert.deepEqual(result.operators['keyword'], ['in', 'not-in', 'some-not-in', 'all', 'filter']);
		assert.deepEqual(result.operators['long'], ['in', 'not-in', 'gt', 'gte', 'lt', 'lte', 'between']);
	});

	test('assigns range operators to date fields in operators map', () => {
		const result = buildCatalogueIntrospectionBody({
			catalogId: 'models',
			documentType: 'model',
			resolvedFields: RESOLVED_FIELDS,
		});

		assert.deepEqual(result.operators['date'], ['in', 'not-in', 'gt', 'gte', 'lt', 'lte', 'between']);
	});

	test('assigns enum-like operators to boolean fields in operators map', () => {
		const result = buildCatalogueIntrospectionBody({
			catalogId: 'models',
			documentType: 'model',
			resolvedFields: RESOLVED_FIELDS,
		});

		assert.deepEqual(result.operators['boolean'], ['in', 'not-in', 'some-not-in', 'all', 'filter']);
	});

	test('includes fields that exist only in the resolved (live) mapping', () => {
		// is_published would not appear in config-file extended data in a typical setup,
		// but appears here because it came from the ES mapping via resolveCatalogueFields.
		const result = buildCatalogueIntrospectionBody({
			catalogId: 'models',
			documentType: 'model',
			resolvedFields: RESOLVED_FIELDS,
		});

		assert.ok('is_published' in result.fields);
	});

	test('omits unit key when field unit is undefined', () => {
		const result = buildCatalogueIntrospectionBody({
			catalogId: 'models',
			documentType: 'model',
			resolvedFields: RESOLVED_FIELDS,
		});

		assert.ok(!('unit' in (result.fields['is_published'] ?? {})));
	});

	test('skips entries without a fieldName', () => {
		const result = buildCatalogueIntrospectionBody({
			catalogId: 'models',
			documentType: 'model',
			resolvedFields: [
				{
					displayName: 'No Name',
					displayType: 'keyword',
					displayValues: {},
					fieldName: '',
					isActive: false,
					isArray: false,
					primaryKey: false,
					quickSearchEnabled: false,
					rangeStep: 0,
					type: 'keyword',
					unit: null,
				},
			],
		});

		assert.deepEqual(result.fields, {});
		assert.deepEqual(result.operators, {});
	});

	test('falls back to displayType when type is absent', () => {
		const result = buildCatalogueIntrospectionBody({
			catalogId: 'models',
			documentType: 'model',
			resolvedFields: [
				{
					displayName: 'Display Only',
					displayType: 'long',
					displayValues: {},
					fieldName: 'display_only',
					isActive: false,
					isArray: false,
					primaryKey: false,
					quickSearchEnabled: false,
					rangeStep: 0,
					type: '',
					unit: null,
				},
			],
		});

		assert.equal(result.fields['display_only']?.type, 'long');
		assert.deepEqual(result.operators['long'], ['in', 'not-in', 'gt', 'gte', 'lt', 'lte', 'between']);
	});

	test('deduplicates operator entries when multiple fields share a type', () => {
		const result = buildCatalogueIntrospectionBody({
			catalogId: 'models',
			documentType: 'model',
			resolvedFields: [
				{ ...RESOLVED_FIELDS[0], fieldName: 'field_a' },
				{ ...RESOLVED_FIELDS[0], fieldName: 'field_b' },
			],
		});

		assert.equal(Object.keys(result.operators).length, 1);
		assert.ok('keyword' in result.operators);
	});
});
