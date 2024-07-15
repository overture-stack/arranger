export default `#graphql
  type Query {
    nodes: [RemoteConnectionNode]
  }

	type RemoteConnectionNode {
		url: String
		name: String
		description: String
		documentName: String
		availableAggregations: [String]
		totalHits: String
		status: String
		errors: [String]
	}
`;
