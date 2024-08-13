export const remoteConnectionTypes = `#graphql
  type Query {
    nodes: [RemoteConnectionNode]
  }

	type RemoteConnectionNode {
		url: String
		name: String
		description: String
		documentName: String
		availableAggregations: [String]
		totalHits: Int
		status: String
		errors: [String]
	}
`;
