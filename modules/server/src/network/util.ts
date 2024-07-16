import { NetworkAggregationConfig } from './types';

type AvailableAggregation = { name: string; type: string };
const filterAvailableAggregations = (agg: unknown): agg is AvailableAggregation => {
	return agg && agg.name !== undefined && agg.type !== undefined;
};

/**
 * TODO: Filter out unsupported aggs
 */
const filterSupportedAggregations = () => {};

export const getAllTypes = (configs: NetworkAggregationConfig[]) => {
	return configs
		.flatMap((config) => config.availableAggregations)
		.filter((agg) => filterAvailableAggregations(agg));
};
