import getNestedSqonFilters from '../../buildAggregations/getNestedSqonFilters';
import { AND_OP, IN_OP } from '../../constants';

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

	expect(getNestedSqonFilters({ nestedFieldNames, sqon })).toEqual(expectedOutput);
});

test('2.getNestedSqonFilters should handle falsy sqon', () => {
	const nestedFieldNames = [];
	const sqon = null;

	expect(getNestedSqonFilters({ nestedFieldNames, sqon })).toEqual({});
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

	expect(getNestedSqonFilters({ nestedFieldNames, sqon })).toEqual({
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
	expect(output).toEqual({});
});
