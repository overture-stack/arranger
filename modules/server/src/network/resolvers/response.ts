import { AllAggregationsMap } from '@/mapping/resolveAggregations';
import { NetworkNode } from './aggregations';

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
