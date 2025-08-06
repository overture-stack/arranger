/**
 * TODO: please move to it's own place in repo
 * shared across repo modules
 */

export type Bucket = {
	doc_count: number;
	key: string;
};

export interface Buckets {
	bucket_count: number;
	buckets: Bucket[];
}

// the GQL Aggregations type
interface Aggregations extends Buckets {
	__typename: typeof aggregationsTypenames.Aggregations;
}

type Stats = {
	max: number;
	min: number;
	count: number;
	avg: number;
	sum: number;
};

// input not response
type Range =
	| { key?: string; to: number; from?: number }
	| { key: string; to?: number; from: number }
	| { key: string; to?: number; from?: number };

export type Ranges = Range[];

// the GQL NumericAggregations type
export interface NumericAggregations {
	__typename: typeof aggregationsTypenames.NumericAggregations;
	stats: Stats;
	range: Buckets;
}

// Arranger aggregations
export type ArrangerAggregations = Aggregations | NumericAggregations;

export const aggregationsTypenames = {
	Aggregations: 'Aggregations',
	NumericAggregations: 'NumericAggregations',
} as const;
export type AggregationsTypename = (typeof aggregationsTypenames)[keyof typeof aggregationsTypenames];
