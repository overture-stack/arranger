import { Relation } from './masking';

export type Bucket = {
	doc_count: number;
	key: string;
	relation: Relation;
};

export type Aggregation = {
	bucket_count: number;
	buckets: Bucket[];
};

export type Root = Record<string, unknown>;

enum Missing {
	first,
	last,
}

enum Mode {
	avg,
	max,
	min,
	sum,
}

enum Order {
	asc,
	desc,
}

export type Sort = {
	fieldName: string;
	order: Order;
	mode: Mode;
	missing: Missing;
};

export type HitsQuery = {
	score: string;
	offset: number;
	sort: [Sort];
	filters: JSON;
	before: string;
	after: string;
	first: number;
	last: number;
	searchAfter: JSON;
	trackTotalHits: boolean;
};

export type AggregationQuery = {
	filters: any;
	aggregations_filter_themselves: boolean;
	include_missing: boolean;
};
