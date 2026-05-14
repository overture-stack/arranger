import { type AllAggregationsMap } from '#mapping/resolveAggregations.js';

import { type NetworkNodeResponseData } from './aggregations.js';

/**
 * Format response object to match GQL type defs
 */
export const createResponse = ({
	aggregationResults,
	nodeInfo,
}: {
	aggregationResults: AllAggregationsMap;
	nodeInfo: NetworkNodeResponseData[];
}) => {
	return { nodes: nodeInfo, aggregations: aggregationResults };
};
