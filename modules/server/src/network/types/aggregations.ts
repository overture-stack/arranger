/*
 * Typescript types for aggregations
 */

import { Relation } from '@/mapping/masking';

export type Bucket = {
	doc_count: number;
	key: string;
	relation: Relation;
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
