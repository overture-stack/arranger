/**
 * Format response object to match gql type defs
 */
export const createResponse = ({ aggregationResults, nodeInfo }) => {
	return { remoteConnections: nodeInfo, aggregations: aggregationResults };
};
