import { ObjectValues } from '@/utils/types';

/**
 * Supported aggregations that can be used by network aggregation
 */
export const SUPPORTED_AGGREGATIONS = {
	Aggregations: 'Aggregations',
	NumericAggregations: 'NumericAggregations',
} as const;

export type SupportedAggregation = ObjectValues<typeof SUPPORTED_AGGREGATIONS>;

export const SUPPORTED_AGGREGATIONS_LIST: string[] = [
	SUPPORTED_AGGREGATIONS.Aggregations,
	SUPPORTED_AGGREGATIONS.NumericAggregations,
];
