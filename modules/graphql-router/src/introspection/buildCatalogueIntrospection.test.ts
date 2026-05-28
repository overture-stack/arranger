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

	test('builds fields with correct displayName, type, unit, and validOperators', () => {
		const result = buildCatalogueIntrospectionBody({
			catalogId: 'models',
			documentType: 'model',
			resolvedFields: RESOLVED_FIELDS,
		});

		assert.deepEqual(result.fields['analysis.state'], {
			displayName: 'Analysis State',
			type: 'keyword',
			unit: null,
			validOperators: ['in', 'not-in', 'some-not-in', 'all', 'filter'],
		});

		assert.deepEqual(result.fields['donor.age'], {
			displayName: 'Donor Age',
			type: 'long',
			unit: 'year',
			validOperators: ['in', 'not-in', 'gt', 'gte', 'lt', 'lte', 'between'],
		});
	});

	test('assigns range operators to date fields', () => {
		const result = buildCatalogueIntrospectionBody({
			catalogId: 'models',
			documentType: 'model',
			resolvedFields: RESOLVED_FIELDS,
		});

		assert.deepEqual(result.fields['collection.date']?.validOperators, [
			'in', 'not-in', 'gt', 'gte', 'lt', 'lte', 'between',
		]);
	});

	test('assigns enum-like operators to boolean fields', () => {
		const result = buildCatalogueIntrospectionBody({
			catalogId: 'models',
			documentType: 'model',
			resolvedFields: RESOLVED_FIELDS,
		});

		assert.deepEqual(result.fields['is_published']?.validOperators, [
			'in', 'not-in', 'some-not-in', 'all', 'filter',
		]);
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
		assert.deepEqual(result.fields['display_only']?.validOperators, [
			'in', 'not-in', 'gt', 'gte', 'lt', 'lte', 'between',
		]);
	});
});
