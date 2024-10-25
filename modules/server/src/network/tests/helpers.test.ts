import { SupportedAggregation } from '../common';
import { getFieldTypes } from '../setup/fields';

describe('helpers', () => {
	test('getField returns both supported and unsupported types', () => {
		const supportedAggregations: SupportedAggregation[] = ['Aggregations'];
		const fields = [
			{
				name: 'analysis__analysis_id',
				type: 'Aggregations',
			},
			{
				name: 'analysis__analysis_state',
				type: 'Aggregations',
			},
			{
				name: 'clinical__donor__number_of_children',
				type: 'HumanAggregate',
			},
		];

		const result = getFieldTypes(fields, supportedAggregations);
		const expectedResult = {
			supportedAggregations: [
				{ name: 'analysis__analysis_id', type: 'Aggregations' },
				{ name: 'analysis__analysis_state', type: 'Aggregations' },
			],
			unsupportedAggregations: [
				{ name: 'clinical__donor__number_of_children', type: 'HumanAggregate' },
			],
		};

		expect(result.supportedAggregations.length).toEqual(
			expectedResult.supportedAggregations.length,
		);
		expect(result.unsupportedAggregations.length).toEqual(
			expectedResult.unsupportedAggregations.length,
		);
	});
});
