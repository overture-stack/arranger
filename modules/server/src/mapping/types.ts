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
