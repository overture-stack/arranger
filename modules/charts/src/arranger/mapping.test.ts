import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { getGQLTypename } from './mapping.js';

const extendedField = (overrides: Partial<Parameters<typeof getGQLTypename>[0]['extendedMapping'][number]> = {}) => ({
	displayName: 'CA19-9 Level',
	displayType: 'keyword',
	displayValues: {},
	fieldName: 'biomarker.ca19-9_level',
	isActive: true,
	isArray: false,
	quickSearchEnabled: false,
	rangeStep: null,
	type: 'keyword',
	...overrides,
});

suite('getGQLTypename', () => {
	test('matches a GraphQL name against its raw extended-mapping field, hyphen included', () => {
		const result = getGQLTypename({
			fieldName: 'biomarker__ca19_9_level',
			extendedMapping: [extendedField()],
		});

		assert.equal(result, 'Aggregations');
	});

	test('falls back to Aggregations when no extended-mapping entry matches', () => {
		const result = getGQLTypename({
			fieldName: 'does_not_exist',
			extendedMapping: [extendedField()],
		});

		assert.equal(result, 'Aggregations');
	});

	test('resolves to NumericAggregations for a numeric ES type', () => {
		const result = getGQLTypename({
			fieldName: 'biomarker__ca19_9_level',
			extendedMapping: [extendedField({ type: 'integer' })],
		});

		assert.equal(result, 'NumericAggregations');
	});
});
