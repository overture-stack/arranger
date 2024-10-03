import { AggregationAccumulator } from '../AggregationAccumulator';
import { aggregation as fixture } from './fixture';

// expected values
const maleCount = 835;
const femaleCount = 812;
const unknownCount = 2;
const bucketCount = 3;

const expectedStats = { max: 100, min: 1, count: 15, avg: 56, sum: 840 };

describe('Network aggregation resolution', () => {
	describe('resolves multiple aggregations into a single aggregation:', () => {
		it('should resolve multiple Aggregations type fields', () => {
			const totalAggs = new AggregationAccumulator();
			const aggregationsToResolve = [
				{ donors_gender: fixture.inputA },
				{ donors_gender: fixture.inputC },
			];
			aggregationsToResolve.forEach((agg) => totalAggs.resolve(agg));

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
			const totalAggs = new AggregationAccumulator();
			const aggregationsToResolve = [
				{ donors_weight: fixture.inputD },
				{ donors_weight: fixture.inputE },
			];
			aggregationsToResolve.forEach((agg) => totalAggs.resolve(agg));

			const result = totalAggs.result();
			const aggregation = result['donors_weight'];
			expect(aggregation.stats).toEqual(expectedStats);
		});
		it('should resolve a combination of Aggregations and NumericAggregations type fields', () => {
			const aggregationsToResolve = [
				{ donors_gender: fixture.inputA, donors_weight: fixture.inputE },
				{ donors_gender: fixture.inputC, donors_weight: fixture.inputD },
			];

			const totalAggs = new AggregationAccumulator();
			aggregationsToResolve.forEach((agg) => {
				totalAggs.resolve(agg);
			});

			const result = totalAggs.result();
			const donorsGenderAgg = result['donors_gender'];
			const donorsWeightAgg = result['donors_weight'];

			expect(donorsGenderAgg.bucket_count).toEqual(bucketCount);
			expect(donorsGenderAgg.buckets.find((bucket) => bucket.key === 'Male')?.doc_count).toEqual(
				maleCount,
			);
			expect(donorsGenderAgg.buckets.find((bucket) => bucket.key === 'Female')?.doc_count).toEqual(
				femaleCount,
			);
			expect(donorsGenderAgg.buckets.find((bucket) => bucket.key === 'Unknown')?.doc_count).toEqual(
				unknownCount,
			);
			expect(donorsWeightAgg.stats).toEqual(expectedStats);
		});
	});
});
