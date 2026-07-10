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

	test(`3.normalizeFilters must preserve numeric zero values`, () => {
		const input = {
			content: {
				fieldName: 'donor.age',
				value: 0,
			},
			op: 'gte',
		};

		const output = {
			content: {
				fieldName: 'donor.age',
				value: [0],
			},
			op: 'gte',
			pivot: null,
		};

		assert.deepEqual(normalizeFilters(input), output);
	});

	test(`4.normalizeFilters must preserve empty-string values`, () => {
		const input = {
			content: {
				fieldName: 'sample.label',
				value: '',
			},
			op: IN_OP,
		};

		const output = {
			content: {
				fieldName: 'sample.label',
				value: [''],
			},
			op: IN_OP,
			pivot: null,
		};

		assert.deepEqual(normalizeFilters(input), output);
	});

	test(`5.normalizeFilters must preserve zero values inside nested groups`, () => {
		const input = {
			content: [
				{
					content: {
						fieldName: 'donor.age',
						value: 0,
					},
					op: 'gte',
				},
			],
			op: AND_OP,
		};

		const output = {
			content: [
				{
					content: {
						fieldName: 'donor.age',
						value: [0],
					},
					op: 'gte',
					pivot: null,
				},
			],
			op: AND_OP,
			pivot: null,
		};

		assert.deepEqual(normalizeFilters(input), output);
	});

	test(`6.normalizeFilters normalizes legacy "filter" op to canonical "wildcard" via OP_ALIASES`, () => {
		const input = {
			content: { fieldNames: ['gene.symbol', 'donor.name'], value: '*brca*' },
			op: 'filter',
		};

		const output = {
			content: { fieldNames: ['gene.symbol', 'donor.name'], value: '*brca*' },
			op: 'wildcard',
			pivot: null,
		};

		assert.deepEqual(normalizeFilters(input), output);
	});

});
