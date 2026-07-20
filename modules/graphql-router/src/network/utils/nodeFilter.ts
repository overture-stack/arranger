/**
 * Given a list of nodes and an optional nodesFilter array, return only nodes
 * whose nodeId appears in the filter. If nodesFilter is absent or empty, all nodes are returned.
 */
export const filterNodesByNodeId = <Node extends { nodeId?: string }>(
	nodes: Node[],
	nodesFilter: string[] | undefined,
): Node[] => {
	if (!nodesFilter || nodesFilter.length === 0) {
		return nodes;
	}
	const filterSet = new Set(nodesFilter);
	return nodes.filter((node) => node.nodeId !== undefined && filterSet.has(node.nodeId));
};
