import { ObjectValues } from '@/utils/types';

/*
 * Network aggregations
 */
export const NETWORK_AGGREGATIONS = {
	NetworkAggregations: 'NetworkAggregations',
	NetworkNumericAggregations: 'NetworkNumericAggregations',
} as const;
export type NetworkAggregation = ObjectValues<typeof NETWORK_AGGREGATIONS>;

/*
 * Supported single aggregations that can be used by network aggregation
 */
export const SUPPORTED_AGGREGATIONS = {
	Aggregations: 'Aggregations',
	NumericAggregations: 'NumericAggregations',
} as const;

export type SUPPORTED_AGGREGATIONS_TYPE = ObjectValues<typeof SUPPORTED_AGGREGATIONS>;

export const SUPPORTED_AGGREGATIONS_LIST: SUPPORTED_AGGREGATIONS_TYPE[] = [
	SUPPORTED_AGGREGATIONS.Aggregations,
	SUPPORTED_AGGREGATIONS.NumericAggregations,
];

/**
 * Multiple cases when we need to map from the "single" aggregation types to the "network"
 *
 * @example
 * "Aggregations" => "NetworkAggregations"
 */
export const singleToNetworkNameMap = new Map<SUPPORTED_AGGREGATIONS_TYPE, NetworkAggregation>()
	.set(SUPPORTED_AGGREGATIONS.Aggregations, NETWORK_AGGREGATIONS.NetworkAggregations)
	.set(SUPPORTED_AGGREGATIONS.NumericAggregations, NETWORK_AGGREGATIONS.NetworkNumericAggregations);

/**
 * Multiple cases when we need to map from the "network" aggregation types to the "single"
 *
 * @example
 * "NetworkAggregations" => "Aggregations"
 */
export const networkToSingleNameMap = new Map<NetworkAggregation, SUPPORTED_AGGREGATIONS_TYPE>()
	.set(NETWORK_AGGREGATIONS.NetworkAggregations, SUPPORTED_AGGREGATIONS.Aggregations)
	.set(NETWORK_AGGREGATIONS.NetworkNumericAggregations, SUPPORTED_AGGREGATIONS.NumericAggregations);
