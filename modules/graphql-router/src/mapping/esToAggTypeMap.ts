const esToAggTypes = {
	boolean: 'Aggregations',
	byte: 'NumericAggregations',
	date: 'NumericAggregations',
	double: 'NumericAggregations',
	float: 'NumericAggregations',
	half_float: 'NumericAggregations',
	id: 'Aggregations',
	integer: 'NumericAggregations',
	keyword: 'Aggregations',
	long: 'NumericAggregations',
	object: 'Aggregations',
	scaled_float: 'NumericAggregations',
	string: 'Aggregations',
	text: 'Aggregations',
	unsigned_long: 'NumericAggregations',
} as const;

export default esToAggTypes;
export type ES_TYPES = keyof typeof esToAggTypes;
