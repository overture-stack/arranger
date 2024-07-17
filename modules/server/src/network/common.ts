import { ObjectValues } from '@/utils/types';

export const SUPPORTED_NETWORK_AGGREGATIONS = {
	NetworkAggregation: 'NetworkAggregation',
	NetworkNumericAggregations: 'NetworkNumericAggregations',
} as const;
export type SupportedNetworkAggregation = ObjectValues<typeof SUPPORTED_NETWORK_AGGREGATIONS>;
