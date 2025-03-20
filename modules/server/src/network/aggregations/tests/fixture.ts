import { Relation } from '@/mapping/masking';
import { Aggregations } from '@/mapping/resolveAggregations';

const inputA: Aggregations = {
	bucket_count: 2,
	buckets: [
		{
			key: 'Male',
			doc_count: 70,
			relation: Relation.eq,
		},
		{
			key: 'Female',
			doc_count: 12,
			relation: Relation.eq,
		},
	],
};

const inputB: Aggregations = {
	bucket_count: 2,
	buckets: [
		{
			key: 'Male',
			doc_count: 15,
			relation: Relation.eq,
		},
		{
			key: 'Female',
			doc_count: 700,
			relation: Relation.eq,
		},
	],
};

const inputC: Aggregations = {
	bucket_count: 3,
	buckets: [
		{
			key: 'Male',
			doc_count: 765,
			relation: Relation.eq,
		},
		{
			key: 'Female',
			doc_count: 800,
			relation: Relation.eq,
		},
		{
			key: 'Unknown',
			doc_count: 2,
			relation: Relation.eq,
		},
	],
};

export const aggregation = {
	inputA,
	inputB,
	inputC,
};
