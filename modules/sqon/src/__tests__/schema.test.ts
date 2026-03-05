import assert from 'node:assert';
import { suite, test } from 'node:test';

import { SqonSchema } from '#schema.js';

suite('sqon/schema', () => {
	test('accepts a leaf-root in filter', () => {
		const input = {
			op: 'in',
			content: { fieldName: 'analysis_state', value: ['OPEN'] },
		};

		const output = SqonSchema.safeParse(input);
		assert.equal(output.success, true);
	});

	test('accepts a group-root with nested content', () => {
		const input = {
			content: [
				{
					content: { fieldName: 'analysis_state', value: ['OPEN'] },
					op: 'in',
				},
				{
					content: [
						{
							op: 'between',
							content: { fieldName: 'donor.age', value: [18, 65] },
						},
						{
							op: 'filter',
							content: { fieldNames: ['donor.name', 'donor.alias'], value: '*jo*' },
						},
					],
					op: 'or',
				},
			],
			op: 'and',
		};

		const output = SqonSchema.safeParse(input);
		assert.equal(output.success, true);
	});

	test('accepts alias operators', () => {
		const rangeAlias = SqonSchema.safeParse({
			content: { fieldName: 'age', value: 10 },
			op: '>=',
		});
		const inAlias = SqonSchema.safeParse({
			content: { fieldName: 'status', value: ['archived'] },
			op: '!=',
		});

		assert.equal(rangeAlias.success, true);
		assert.equal(inAlias.success, true);
	});

	test('accepts all currently supported field operators', () => {
		const candidates = [
			{ op: 'in', content: { fieldName: 'a', value: ['x'] } },
			{ op: 'not-in', content: { fieldName: 'a', value: ['x'] } },
			{ op: 'some-not-in', content: { fieldName: 'a', value: ['x'] } },
			{ op: 'all', content: { fieldName: 'a', value: ['x', 'y'] } },
			{ op: 'gt', content: { fieldName: 'n', value: 1 } },
			{ op: 'gte', content: { fieldName: 'n', value: [1] } },
			{ op: 'lt', content: { fieldName: 'n', value: 10 } },
			{ op: 'lte', content: { fieldName: 'n', value: [10] } },
			{ op: 'between', content: { fieldName: 'n', value: [1, 10] } },
			{ op: 'filter', content: { fieldNames: ['a', 'b'], value: '*val*' } },
		];

		candidates.forEach((candidate) => {
			const output = SqonSchema.safeParse(candidate);
			assert.equal(output.success, true, `Expected valid SQON for op "${candidate.op}"`);
		});
	});

	test('allows passthrough extra keys', () => {
		const input = {
			content: {
				fieldName: 'analysis_state',
				value: ['OPEN'],
				extraContent: 123,
			},
			extraTopLevel: 'ignored',
			op: 'in',
		};

		const output = SqonSchema.safeParse(input);
		assert.equal(output.success, true);
	});

	test('rejects unknown operator', () => {
		const input = {
			content: { fieldName: 'analysis_state', value: ['OPEN'] },
			op: 'contains',
		};

		const output = SqonSchema.safeParse(input);
		assert.equal(output.success, false);
	});

	test('rejects missing content', () => {
		const input = {
			op: 'in',
		};

		const output = SqonSchema.safeParse(input);
		assert.equal(output.success, false);
	});

	test('rejects invalid filter operator payload shape', () => {
		const input = {
			content: { fieldName: 'analysis_state', value: ['OPEN'] },
			op: 'filter',
		};

		const output = SqonSchema.safeParse(input);
		assert.equal(output.success, false);
	});

	test('rejects between with one-length array', () => {
		const input = {
			content: { fieldName: 'donor.age', value: [18] },
			op: 'between',
		};

		const output = SqonSchema.safeParse(input);
		assert.equal(output.success, false);
	});

	test('rejects group with non-array content', () => {
		const input = {
			content: { op: 'in', content: { fieldName: 'a', value: ['x'] } },
			op: 'and',
		};

		const output = SqonSchema.safeParse(input);
		assert.equal(output.success, false);
	});
});
