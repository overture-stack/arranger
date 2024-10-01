import { AggregationAccumulator } from '../AggregationAccumulator';

describe('Network aggregation resolution', () => {
	it('should compute requested keys from info map constructor param', () => {
		const requestedFields = { donors_age: {}, donors_gender: {} };
		const totalAggs = new AggregationAccumulator(requestedFields);

		expect(totalAggs.requestedFields.sort()).toEqual(Object.keys(requestedFields).sort());
	});
});
