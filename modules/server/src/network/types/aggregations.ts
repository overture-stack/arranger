/*
 * Typescript types for aggregations
 */

export type Bucket = {
	doc_count: number;
	key: string;
};

export type Aggregations = {
	__typename: 'Aggregations';
	bucket_count: number;
	buckets: Bucket[];
};

type Stats = {
	max: number;
	min: number;
	count: number;
	avg: number;
	sum: number;
};

export type NumericAggregations = { __typename: 'NumericAggregations'; stats: Stats };
