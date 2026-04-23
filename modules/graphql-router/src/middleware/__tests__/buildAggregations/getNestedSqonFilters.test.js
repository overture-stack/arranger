import assert from 'node:assert';
import { suite, test } from 'node:test';

import getNestedSqonFilters from '#middleware/buildAggregations/getNestedSqonFilters.js';
import { AND_OP, IN_OP } from '#middleware/constants.js';

suite('middleware/getNestedSQONFilters', () => {

	test('1.getNestedSqonFilters should be able to extract filters applied on nested fields', () => {
		const nestedFieldNames = ['a', 'a.b'];
		const sqon = {
			op: AND_OP,
			content: [
				{ op: IN_OP, content: { fieldName: 'a', value: [] } },
				{ op: IN_OP, content: { fieldName: 'a', value: [] } },
				{ op: IN_OP, content: { fieldName: 'a.c', value: [] } },
				{ op: IN_OP, content: { fieldName: 'a.b.c', value: [] } },
				{ op: IN_OP, content: { fieldName: 'a.b.d', value: [] } },
			],
		};

		const expectedOutput = {
			a: [{ op: IN_OP, pivot: null, content: { fieldName: 'a.c', value: [] } }],
			'a.b': [
				{ op: IN_OP, pivot: null, content: { fieldName: 'a.b.c', value: [] } },
				{ op: IN_OP, pivot: null, content: { fieldName: 'a.b.d', value: [] } },
			],
		};

		assert.deepEqual(getNestedSqonFilters({ nestedFieldNames, sqon }), expectedOutput);
	});

	test('2.getNestedSqonFilters should handle falsy sqon', () => {
		const nestedFieldNames = [];
		const sqon = null;

		assert.deepEqual(getNestedSqonFilters({ nestedFieldNames, sqon }), {});
	});

	test('3.getNestedSqonFilters should handle nested sqons', () => {
		const nestedFieldNames = ['files'];
		const sqon = {
			op: AND_OP,
			pivot: null,
			content: [
				{
					op: AND_OP,
					content: [
						{
							op: IN_OP,
							pivot: null,
							content: {
								fieldName: 'files.kf_id',
								value: ['GF_V1C32MZ6'],
							},
						},
						{
							op: IN_OP,
							pivot: null,
							content: {
								fieldName: 'files.kf_id',
								value: ['GF_C78A0NP8'],
							},
						},
					],
				},
			],
		};

		assert.deepEqual(getNestedSqonFilters({ nestedFieldNames, sqon }), {
			files: [
				{
					op: IN_OP,
					pivot: null,
					content: {
						fieldName: 'files.kf_id',
						value: ['GF_V1C32MZ6'],
					},
				},
				{
					op: IN_OP,
					pivot: null,
					content: {
						fieldName: 'files.kf_id',
						value: ['GF_C78A0NP8'],
					},
				},
			],
		});
	});

	test('4.getNestedSqonFilters should ignore fields pivotted operations', () => {
		const nestedFieldNames = ['files'];
		const sqon = {
			op: AND_OP,
			pivot: null,
			content: [
				{
					op: AND_OP,
					pivot: 'files',
					content: [
						{
							op: IN_OP,
							pivot: null,
							content: { fieldName: 'files.kf_id', value: ['GF_V1C32MZ6'] },
						},
						{
							op: IN_OP,
							pivot: null,
							content: { fieldName: 'files.kf_id', value: ['GF_C78A0NP8'] },
						},
					],
				},
			],
		};

		const output = getNestedSqonFilters({ nestedFieldNames, sqon });
		assert.deepEqual(output, {});
	});

});