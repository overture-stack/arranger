/*
 * Typescript types for aggregations
 */

type Stats = {
	max: number;
	min: number;
	count: number;
	avg: number;
	sum: number;
};

export type NumericAggregations = { stats: Stats };
