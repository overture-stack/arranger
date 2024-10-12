import { Aggregations, NumericAggregations } from '@/network/types/aggregations';

const inputA: Aggregations = {
	__typename: 'Aggregations',
	bucket_count: 2,
	buckets: [
		{
			key: 'Male',
			doc_count: 70,
		},
		{
			key: 'Female',
			doc_count: 12,
		},
	],
};

const inputB: Aggregations = {
	__typename: 'Aggregations',
	bucket_count: 2,
	buckets: [
		{
			key: 'Male',
			doc_count: 15,
		},
		{
			key: 'Female',
			doc_count: 700,
		},
	],
};

const inputC: Aggregations = {
	__typename: 'Aggregations',
	bucket_count: 3,
	buckets: [
		{
			key: 'Male',
			doc_count: 765,
		},
		{
			key: 'Female',
			doc_count: 800,
		},
		{
			key: 'Unknown',
			doc_count: 2,
		},
	],
};

// NumericAggregations
const inputD: NumericAggregations = {
	__typename: 'NumericAggregations',
	stats: { max: 100, min: 12, count: 10, avg: 42, sum: 420 },
};

const inputE: NumericAggregations = {
	__typename: 'NumericAggregations',
	stats: { max: 75, min: 1, count: 5, avg: 84, sum: 420 },
};

export const aggregation = {
	inputA,
	inputB,
	inputC,
	inputD,
	inputE,
};
