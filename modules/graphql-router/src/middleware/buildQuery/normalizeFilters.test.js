import assert from 'node:assert';
import { suite, test } from 'node:test';

import normalizeFilters from '#middleware/buildQuery/normalizeFilters.js';
import { IN_OP, OR_OP, AND_OP, ALL_OP, NOT_OP } from '#middleware/constants.js';

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

	// Flattening a same-op child into its parent is associativity, which `not` lacks: `not[not[X]]`
	// is X, so collapsing it to `not[X]` returns the complement of what was asked for. Confirmed
	// against a live cluster before and after. Tests 8 and 9 guard the opposite over-correction.
	test(`7.normalizeFilters must not flatten a nested "not" into its parent "not"`, () => {
		const leaf = { content: { fieldName: 'b', value: ['x'] }, op: IN_OP };
		const input = { content: [{ content: [leaf], op: NOT_OP }], op: NOT_OP };

		const output = {
			content: [{ content: [{ ...leaf, pivot: null }], op: NOT_OP, pivot: null }],
			op: NOT_OP,
			pivot: null,
		};

		assert.deepEqual(normalizeFilters(input), output);
	});

	test(`8.normalizeFilters must still flatten a nested "and" into its parent "and"`, () => {
		const leaf = { content: { fieldName: 'b', value: ['x'] }, op: IN_OP };
		const input = { content: [{ content: [leaf], op: AND_OP }], op: AND_OP };

		const output = { content: [{ ...leaf, pivot: null }], op: AND_OP, pivot: null };

		assert.deepEqual(normalizeFilters(input), output);
	});

	test(`9.normalizeFilters must still flatten a nested "or" into its parent "or"`, () => {
		const leaf = { content: { fieldName: 'b', value: ['x'] }, op: IN_OP };
		const input = { content: [{ content: [leaf], op: OR_OP }], op: OR_OP };

		const output = { content: [{ ...leaf, pivot: null }], op: OR_OP, pivot: null };

		assert.deepEqual(normalizeFilters(input), output);
	});

	test(`10.normalizeFilters must preserve a nested "not" alongside a sibling under "not"`, () => {
		const excluded = { content: { fieldName: 'a', value: ['1'] }, op: IN_OP };
		const negated = { content: { fieldName: 'b', value: ['x'] }, op: IN_OP };
		const input = { content: [excluded, { content: [negated], op: NOT_OP }], op: NOT_OP };

		const output = {
			content: [
				{ ...excluded, pivot: null },
				{ content: [{ ...negated, pivot: null }], op: NOT_OP, pivot: null },
			],
			op: NOT_OP,
			pivot: null,
		};

		assert.deepEqual(normalizeFilters(input), output);
	});
});
