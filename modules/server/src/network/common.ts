import { ObjectValues } from '@/utils/types';

export const NETWORK_AGGREGATIONS = {
	NetworkAggregation: 'NetworkAggregation',
	NetworkNumericAggregations: 'NetworkNumericAggregations',
} as const;
export type NetworkAggregation = ObjectValues<typeof NETWORK_AGGREGATIONS>;

const SUPPORTED_AGGREGATIONS = {
	Aggregations: 'Aggregations',
	NumericAggregations: 'NumericAggregations',
} as const;

export const SUPPORTED_AGGREGATIONS_LIST: ObjectValues<typeof SUPPORTED_AGGREGATIONS>[] = [
	SUPPORTED_AGGREGATIONS.Aggregations,
	SUPPORTED_AGGREGATIONS.NumericAggregations,
];
