/**
 * TODO: please move to it's own place in repo
 * shared across repo modules
 */

export type Bucket = {
	doc_count: number;
	key: string;
};

export type CommonAggregationProperties = {
	bucket_count: number;
	buckets: Bucket[];
};

// the GQL Aggregations type
export type Aggregations = CommonAggregationProperties;

type Stats = {
	max: number;
	min: number;
	count: number;
	avg: number;
	sum: number;
};

// the GQL NumericAggregations type
export type NumericAggregations = CommonAggregationProperties & { stats: Stats };
