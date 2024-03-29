import { generateNextSQON } from '../TextFilter.js';

const emptySQON = {
	op: 'and',
	content: [],
};

const sqonWithoutFilter = {
	op: 'and',
	content: [
		{
			op: 'in',
			content: {
				fieldName: 'field1',
				value: ['one', 'two', 'three'],
			},
		},
	],
};

const sqonWithFilter = {
	op: 'and',
	content: [
		{
			op: 'in',
			content: {
				fieldName: 'field1',
				value: ['one', 'two', 'three'],
			},
		},
		{
			op: 'filter',
			content: {
				fieldNames: ['field1', 'field2'],
				value: 'search value',
			},
		},
	],
};

describe('generateNextSQON', () => {
	it('1.should add a filter op to sqon that does not have one', () => {
		expect(
			generateNextSQON('new value')({
				sqon: emptySQON,
				fieldNames: ['field3', 'field4'],
			}),
		).toEqual({
			op: 'and',
			content: [
				{
					op: 'filter',
					content: {
						fieldNames: ['field3', 'field4'],
						value: 'new value',
					},
				},
			],
		});
	});

	it('2.should remove a filter op if fieldNames are not specified', () => {
		[null, []].forEach((fieldNames) =>
			expect(generateNextSQON('value')({ sqon: sqonWithFilter, fieldNames })).toEqual(
				sqonWithoutFilter,
			),
		);
	});

	it('3.should remove a filter op if value is not specified', () => {
		[null, ''].forEach((value) =>
			expect(
				generateNextSQON(value)({
					sqon: sqonWithFilter,
					fieldNames: ['field3, field4'],
				}),
			).toEqual(sqonWithoutFilter),
		);
	});

	it('4.should replace an existing filter with a new valid one', () => {
		expect(
			generateNextSQON('another value')({
				sqon: sqonWithFilter,
				fieldNames: ['field3', 'field4'],
			}),
		).toEqual({
			op: 'and',
			content: [
				{
					op: 'in',
					content: {
						fieldName: 'field1',
						value: ['one', 'two', 'three'],
					},
				},
				{
					op: 'filter',
					content: {
						fieldNames: ['field3', 'field4'],
						value: 'another value',
					},
				},
			],
		});
	});
});
