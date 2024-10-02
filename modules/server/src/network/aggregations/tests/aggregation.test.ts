import { AggregationAccumulator } from '../AggregationAccumulator';
import { aggregation as fixture } from './fixture';

describe('Network aggregation resolution', () => {
	it('should compute requested keys from info map constructor param', () => {
		const requestedFields = { donors_age: {}, donors_gender: {} };
		const totalAggs = new AggregationAccumulator(requestedFields);
		expect(totalAggs.requestedFields.sort()).toEqual(Object.keys(requestedFields).sort());
	});

	describe('resolves multiple aggregations into a single aggregation:', () => {
		it('should resolve multiple Aggregations type fields', () => {
			const requestedFields = { donors_gender: {} };
			const totalAggs = new AggregationAccumulator(requestedFields);
			const aggregationsToResolve = [
				{ donors_gender: fixture.inputA },
				{ donors_gender: fixture.inputC },
			];
			aggregationsToResolve.forEach((agg) => totalAggs.resolve(agg));

			// expected values
			const maleCount = 835;
			const femaleCount = 812;
			const unknownCount = 2;
			const bucketCount = 3;

			const result = totalAggs.result();
			const aggregation = result['donors_gender'];

			expect(aggregation.bucket_count).toEqual(bucketCount);
			expect(aggregation.buckets.find((bucket) => bucket.key === 'Male')?.doc_count).toEqual(
				maleCount,
			);
			expect(aggregation.buckets.find((bucket) => bucket.key === 'Female')?.doc_count).toEqual(
				femaleCount,
			);
			expect(aggregation.buckets.find((bucket) => bucket.key === 'Unknown')?.doc_count).toEqual(
				unknownCount,
			);
		});
		it('should resolve multiple NumericAggregations type fields', () => {
			const requestedFields = { donors_weight: {} };
			const totalAggs = new AggregationAccumulator(requestedFields);
			const aggregationsToResolve = [
				{ donors_weight: fixture.inputD },
				{ donors_weight: fixture.inputE },
			];
			aggregationsToResolve.forEach((agg) => totalAggs.resolve(agg));

			// expected values
			const maleCount = 835;
			const femaleCount = 812;
			const unknownCount = 2;
			const bucketCount = 3;

			const result = totalAggs.result();
			const aggregation = result['donors_gender'];

			expect(aggregation.bucket_count).toEqual(bucketCount);
			expect(aggregation.buckets.find((bucket) => bucket.key === 'Male')?.doc_count).toEqual(
				maleCount,
			);
			expect(aggregation.buckets.find((bucket) => bucket.key === 'Female')?.doc_count).toEqual(
				femaleCount,
			);
			expect(aggregation.buckets.find((bucket) => bucket.key === 'Unknown')?.doc_count).toEqual(
				unknownCount,
			);
		});
		it('should resolve a combination of Aggregations and NumericAggregations type fields', () => {
			expect(true).toEqual(false);
		});
	});
});
