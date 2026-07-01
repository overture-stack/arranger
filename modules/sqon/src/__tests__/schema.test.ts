import assert from 'node:assert';
import { suite, test } from 'node:test';

import { SqonSchema } from '#schema/index.js';

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

	test('accepts falsy but valid scalar values', () => {
		const zeroValue = SqonSchema.safeParse({
			content: { fieldName: 'donor.age', value: 0 },
			op: 'gte',
		});
		const emptyStringValue = SqonSchema.safeParse({
			content: { fieldName: 'sample.label', value: '' },
			op: 'in',
		});

		assert.equal(zeroValue.success, true);
		assert.equal(emptyStringValue.success, true);
	});

	test('accepts boolean true as a scalar value in an in filter', () => {
		const output = SqonSchema.safeParse({
			op: 'in',
			content: { fieldName: 'sample.flagged', value: true },
		});
		assert.equal(output.success, true);
	});

	test('accepts boolean false as a scalar value in an in filter', () => {
		const output = SqonSchema.safeParse({
			op: 'in',
			content: { fieldName: 'sample.flagged', value: false },
		});
		assert.equal(output.success, true);
	});

	test('accepts boolean values in an array for an in filter', () => {
		const output = SqonSchema.safeParse({
			op: 'in',
			content: { fieldName: 'sample.flags', value: [true, false] },
		});
		assert.equal(output.success, true);
	});

	test('accepts boolean as a scalar value in a range filter', () => {
		const output = SqonSchema.safeParse({
			op: 'gt',
			content: { fieldName: 'sample.flagged', value: true },
		});
		assert.equal(output.success, true);
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

	test('accepts current special Arranger values used downstream', () => {
		const candidates = [
			{ op: 'in', content: { fieldName: 'sample.id', value: ['set_id:my-set'] } },
			{ op: 'in', content: { fieldName: 'sample.id', value: ['__missing__'] } },
			{ op: 'in', content: { fieldName: 'sample.id', value: ['ABC*'] } },
		];

		candidates.forEach((candidate) => {
			const output = SqonSchema.safeParse(candidate);
			assert.equal(output.success, true, `Expected valid SQON for special value "${candidate.content.value[0]}"`);
		});
	});

	test('accepts pivot on both leaf and group nodes', () => {
		const leaf = SqonSchema.safeParse({
			op: 'in',
			pivot: 'nested',
			content: { fieldName: 'nested.field', value: ['x'] },
		});
		const group = SqonSchema.safeParse({
			op: 'and',
			pivot: 'nested',
			content: [
				{
					op: 'in',
					content: { fieldName: 'nested.field', value: ['x'] },
				},
			],
		});

		assert.equal(leaf.success, true);
		assert.equal(group.success, true);
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

	test('rejects between with a scalar value', () => {
		const input = {
			content: { fieldName: 'donor.age', value: 18 },
			op: 'between',
		};

		const output = SqonSchema.safeParse(input);
		assert.equal(output.success, false);
	});

	test('rejects between with more than two values', () => {
		const input = {
			content: { fieldName: 'donor.age', value: [18, 65, 100] },
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

	test('rejects leaf with an empty fieldName', () => {
		const operators = ['in', 'not-in', 'some-not-in', 'all', 'gt', 'gte', 'lt', 'lte'];
		operators.forEach((op) => {
			const input = { op, content: { fieldName: '', value: ['x'] } };
			const output = SqonSchema.safeParse(input);
			assert.equal(output.success, false, `Expected empty fieldName to be rejected for op "${op}"`);
		});
	});

	test('rejects all with a scalar value', () => {
		const input = {
			content: { fieldName: 'donor.status', value: 'active' },
			op: 'all',
		};

		const output = SqonSchema.safeParse(input);
		assert.equal(output.success, false);
	});

	test('accepts a wildcard filter node with op "wildcard"', () => {
		const input = {
			op: 'wildcard',
			content: { fieldNames: ['donor.name', 'donor.alias'], value: 'jo*' },
		};
		assert.equal(SqonSchema.safeParse(input).success, true);
	});

	test('accepts a wildcard filter node with op "filter" for backward compatibility', () => {
		const input = {
			op: 'filter',
			content: { fieldNames: ['donor.name'], value: 'jo*' },
		};
		assert.equal(SqonSchema.safeParse(input).success, true);
	});


	test('rejects filter with an empty string in fieldNames', () => {
		const input = {
			content: { fieldNames: ['donor.name', ''], value: 'jo' },
			op: 'filter',
		};

		const output = SqonSchema.safeParse(input);
		assert.equal(output.success, false);
	});
});
