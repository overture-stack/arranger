import { NetworkAggregationConfig, NetworkFieldType } from './types';

type AvailableAggregation = { name: string; type: string };
const filterAvailableAggregations = (agg: unknown): agg is AvailableAggregation => {
	return agg && agg.name !== undefined && agg.type !== undefined;
};

/**
 * TODO: Filter out unsupported aggs
 */
const filterSupportedAggregations = () => {};

/**
 * Returns an array of all field/type
 * @param configs
 * @returns
 */
export const getAllTypes = (configs: NetworkAggregationConfig[]): NetworkFieldType[] => {
	return configs
		.flatMap((config) => config.availableAggregations)
		.filter((agg) => filterAvailableAggregations(agg));
};
