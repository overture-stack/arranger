import assert from 'node:assert';
import { suite, test } from 'node:test';

import getNestedFields from '#mapping/getNestedFields';

suite('getNestedFields', () => {
	test('1.getNestedFields with nested at the root level', () => {
		const actual = getNestedFields({
			diagnoses: {
				type: 'nested',
				properties: {
					age_at_diagnosis: {
						type: 'long',
					},
					project: {
						properties: {
							project_id: {
								type: 'keyword',
							},
						},
					},
					treatments: {
						type: 'nested',
						properties: {
							days_to_treatment: {
								type: 'long',
							},
						},
					},
				},
			},
		});

		const expected = ['diagnoses', 'diagnoses.treatments'];

		assert.equal(actual.length, expected.length);

		expected.forEach((field, i) => assert.equal(field, actual[i]));
	});

	test('2.getNestedFields with object deeply nested', () => {
		const actual = getNestedFields({
			family: {
				properties: {
					family_members: {
						type: 'nested',
						properties: {
							available_data_types: {
								type: 'keyword',
							},
							created_at: {
								type: 'date',
							},
						},
					},
				},
			},
		});

		const expected = ['family.family_members'];

		assert.equal(actual.length, expected.length);
		expected.forEach((field, i) => assert.equal(field, actual[i]));
	});
});