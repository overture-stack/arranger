import assert from 'node:assert';
import { suite, test } from 'node:test';

import normalizeFilters from '#middleware/buildQuery/normalizeFilters.js';
import { IN_OP, OR_OP, AND_OP, ALL_OP } from '#middleware/constants.js';

suite('middleware/normalizeFilter', () => {

	test(`1.normalizeFilters must handle falsy sqon`, () => {
		const input = null;
		const output = null;

		assert.deepEqual(normalizeFilters(input), output);
	});

	test(`2.normalizeFilters must preserve pivots`, () => {
		const input = {
			content: [
				{
					content: {
						fieldName: 'nested.some_field',
						value: ['val1'],
					},
					op: IN_OP,
					pivot: 'nested',
				},
			],
			op: AND_OP,
		};

		const output = {
			content: [
				{
					content: {
						fieldName: 'nested.some_field',
						value: ['val1'],
					},
					op: IN_OP,
					pivot: 'nested',
				},
			],
			op: AND_OP,
			pivot: null,
		};

		assert.deepEqual(normalizeFilters(input), output);
	});

});
