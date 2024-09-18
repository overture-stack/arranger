/**
 * Format response object to match gql type
 */
export const createResponse = ({ aggregationResults, nodeInfo }) => {
	return { remoteConnections: nodeInfo, aggregations: aggregationResults };
};
