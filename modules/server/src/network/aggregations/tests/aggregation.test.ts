import { resolveAggregation } from '..';
import { aggregation } from './fixture';

describe('Aggregation', () => {
	it('should resolve multiple objects of type Aggregation into a single object of type NetworkAggregation', () => {
		const result = resolveAggregation([aggregation.inputA, aggregation.inputB]);

		const resultForMaleCount =
			result.buckets.find((bucket) => bucket.key === 'Male')?.doc_count || 0;
		const resultForFemaleCount =
			result.buckets.find((bucket) => bucket.key === 'Female')?.doc_count || 0;

		const expectedMaleCount =
			(aggregation.inputA.buckets.find((bucket) => bucket.key === 'Male')?.doc_count || 0) +
			(aggregation.inputB.buckets.find((bucket) => bucket.key === 'Male')?.doc_count || 0);

		const expectedFemaleCount =
			(aggregation.inputA.buckets.find((bucket) => bucket.key === 'Female')?.doc_count || 0) +
			(aggregation.inputB.buckets.find((bucket) => bucket.key === 'Female')?.doc_count || 0);

		expect(result.bucket_count).toEqual(
			aggregation.inputA.bucket_count + aggregation.inputB.bucket_count,
		);
		expect(resultForMaleCount).toEqual(expectedMaleCount);
		expect(resultForFemaleCount).toEqual(expectedFemaleCount);
	});
});
