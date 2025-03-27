import { type AllAggregationsMap } from '#mapping/resolveAggregations.js';
import { type NetworkNode } from './aggregations.js';

/**
 * Format response object to match GQL type defs
 */
export const createResponse = ({
	aggregationResults,
	nodeInfo,
}: {
	aggregationResults: AllAggregationsMap;
	nodeInfo: NetworkNode[];
}) => {
	return { nodes: nodeInfo, aggregations: aggregationResults };
};
