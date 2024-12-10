import { Client } from '@elastic/elasticsearch';

export type Bucket = {
	doc_count: number;
	key: string;
	belowThreshold: boolean;
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

export type Hits = {
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

export type Context = {
	es: Client;
};
