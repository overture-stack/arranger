import { ObjectValues } from '@/utils/types';

/**
 * Supported aggregations that can be used by network aggregation
 */
export const SUPPORTED_AGGREGATION = {
	Aggregations: 'Aggregations',
	NumericAggregations: 'NumericAggregations',
} as const;

export type SupportedAggregation = ObjectValues<typeof SUPPORTED_AGGREGATION>;

export const SUPPORTED_AGGREGATIONS_LIST: string[] = [
	SUPPORTED_AGGREGATION.Aggregations,
	SUPPORTED_AGGREGATION.NumericAggregations,
];
