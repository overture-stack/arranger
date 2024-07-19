import { ObjectValues } from '@/utils/types';

export const NETWORK_AGGREGATIONS = {
	NetworkAggregation: 'NetworkAggregation',
	NetworkNumericAggregations: 'NetworkNumericAggregations',
} as const;
export type NetworkAggregation = ObjectValues<typeof NETWORK_AGGREGATIONS>;

export const SUPPORTED_AGGREGATIONS = {
	Aggregations: 'Aggregations',
	NumericAggregations: 'NumericAggregations',
} as const;

export type SUPPORTED_AGGREGATIONS_TYPE = ObjectValues<typeof SUPPORTED_AGGREGATIONS>;

export const SUPPORTED_AGGREGATIONS_LIST: SUPPORTED_AGGREGATIONS_TYPE[] = [
	SUPPORTED_AGGREGATIONS.Aggregations,
	SUPPORTED_AGGREGATIONS.NumericAggregations,
];
