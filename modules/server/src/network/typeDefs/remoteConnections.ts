export const remoteConnectionTypes = `#graphql
  type Query {
    nodes: [RemoteConnectionNode]
  }

	type RemoteConnectionNode {
		name: String
		count: Int
		status: String
		errors: [String]
	}
`;
