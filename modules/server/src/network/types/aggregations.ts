/*
 * Typescript types for aggregations
 */

export type Bucket = {
	doc_count: number;
	key: string;
};

export type Aggregations = {
	__typename?: string;
	bucket_count: number;
	buckets: Bucket[];
};

export type NumericAggregations = { __typename?: string };
