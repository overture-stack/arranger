import { AllAggregations } from '../types/types';
import { NetworkNode } from './networkNode';

/**
 * Format response object to match GQL type defs
 */
export const createResponse = ({
	aggregationResults,
	nodeInfo,
}: {
	aggregationResults: AllAggregations;
	nodeInfo: NetworkNode[];
}) => {
	return { nodes: nodeInfo, aggregations: aggregationResults };
};
