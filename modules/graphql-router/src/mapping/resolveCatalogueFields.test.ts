import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import resolveCatalogueFields from './resolveCatalogueFields.js';

suite('resolveCatalogueFields', () => {
	test('includes a field that exists in the mapping but is absent from extended config', () => {
		const mapping = { analysis_state: { type: 'keyword' } };

		const result = resolveCatalogueFields(mapping, []);

		assert.equal(result.length, 1);
		assert.equal(result[0]?.fieldName, 'analysis_state');
		assert.equal(result[0]?.type, 'keyword');
	});

	test('applies default display properties for mapping-only fields', () => {
		const mapping = { donor_age: { type: 'long' } };

		const result = resolveCatalogueFields(mapping, []);

		const field = result[0];
		assert.ok(field);
		assert.equal(field.fieldName, 'donor_age');
		// startCase converts underscores to spaces and capitalizes
		assert.equal(field.displayName, 'Donor Age');
		assert.equal(field.isActive, false);
		assert.equal(field.unit, null);
	});

	test('uses config display properties when a field appears in both mapping and extended config', () => {
		const mapping = { donor_age: { type: 'long' } };
		const extendedConfigs = [
			{
				fieldName: 'donor_age',
				displayName: 'Age at Diagnosis',
				displayType: 'number',
				displayValues: {},
				isActive: true,
				isArray: false,
				primaryKey: false,
				quickSearchEnabled: true,
				rangeStep: 1,
				type: 'long',
				unit: 'year',
			},
		];

		const result = resolveCatalogueFields(mapping, extendedConfigs);

		const field = result[0];
		assert.ok(field);
		assert.equal(field.fieldName, 'donor_age');
		assert.equal(field.displayName, 'Age at Diagnosis');
		assert.equal(field.isActive, true);
		assert.equal(field.unit, 'year');
	});

	test('excludes a field that exists only in extended config and not in the mapping', () => {
		const mapping = { analysis_state: { type: 'keyword' } };
		const extendedConfigs = [
			{
				fieldName: 'config_only_field',
				displayName: 'Config Only',
				displayType: 'keyword',
				displayValues: {},
				isActive: true,
				isArray: false,
				primaryKey: false,
				quickSearchEnabled: false,
				rangeStep: 0,
				type: 'keyword',
				unit: null,
			},
		];

		const result = resolveCatalogueFields(mapping, extendedConfigs);

		const fieldNames = result.map((f) => f.fieldName);
		assert.ok(!fieldNames.includes('config_only_field'));
		assert.ok(fieldNames.includes('analysis_state'));
	});

	test('resolves nested mapping fields to dot-notation fieldNames', () => {
		const mapping = {
			donor: {
				properties: {
					age: { type: 'long' },
					gender: { type: 'keyword' },
				},
			},
		};

		const result = resolveCatalogueFields(mapping, []);

		const fieldNames = result.map((f) => f.fieldName);
		assert.ok(fieldNames.includes('donor.age'));
		assert.ok(fieldNames.includes('donor.gender'));
	});

	test('returns an empty array when the mapping is empty', () => {
		const result = resolveCatalogueFields({}, []);

		assert.deepEqual(result, []);
	});
});
