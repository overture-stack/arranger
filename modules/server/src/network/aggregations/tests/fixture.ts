import { Aggregations } from '@/network/types';

// Aggregation
const inputA: Aggregations = {
	bucket_count: 82,
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
	bucket_count: 715,
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
	bucket_count: 1565,
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
			doc_count: 0,
		},
	],
};

export const aggregation = {
	inputA,
	inputB,
	inputC,
};
