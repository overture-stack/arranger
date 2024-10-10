import { ALL_NETWORK_AGGREGATION_TYPES_MAP } from '@/network';
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
			jest.mock('../../index', () => ({
				ALL_NETWORK_AGGREGATION_TYPES_MAP: new Map<string, string>([
					['donors_gender', 'Aggregations'],
				]),
			}));

			const totalAggs = new AggregationAccumulator({ donors_gender: {} });
			const aggregationsToResolve = [
				{ aggregations: { donors_gender: fixture.inputA }, hits: { total: 82 } },
				{ aggregations: { donors_gender: fixture.inputC }, hits: { total: 1567 } },
			];
			aggregationsToResolve.forEach(({ aggregations, hits }) =>
				totalAggs.resolve({ aggregations, hits }),
			);

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
			jest.mock('../../index', () => ({
				ALL_NETWORK_AGGREGATION_TYPES_MAP: new Map<string, string>([
					['donors_weight', 'NumericAggregations'],
				]),
			}));

			const totalAggs = new AggregationAccumulator({ donors_weight: {} });
			const aggregationsToResolve = [
				{ aggregations: { donors_weight: fixture.inputD }, hits: { total: 999 } },
				{ aggregations: { donors_weight: fixture.inputE }, hits: { total: 999 } },
			];

			aggregationsToResolve.forEach(({ aggregations, hits }) =>
				totalAggs.resolve({ aggregations, hits }),
			);

			const result = totalAggs.result();
			const aggregation = result['donors_weight'];
			expect(aggregation.stats).toEqual(expectedStats);
		});

		it('should resolve a combination of Aggregations and NumericAggregations type fields', () => {
			jest.mock('../../index', () => ({
				ALL_NETWORK_AGGREGATION_TYPES_MAP: new Map<string, string>([
					['donors_gender', 'Aggregations'],
					['donors_weight', 'NumericAggregations'],
				]),
			}));
			const aggregationsToResolve = [
				{
					aggregations: { donors_gender: fixture.inputA, donors_weight: fixture.inputE },
					hits: { total: 999 },
				},
				{
					aggregations: { donors_gender: fixture.inputC, donors_weight: fixture.inputD },
					hits: { total: 999 },
				},
			];

			const totalAggs = new AggregationAccumulator({ donors_gender: {}, donors_weight: {} });
			aggregationsToResolve.forEach(({ aggregations, hits }) => {
				totalAggs.resolve({ aggregations, hits });
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
