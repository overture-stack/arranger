import type { LocalNodeConfig, NodeConfig, RemoteNodeConfig } from './index.js';

/**
 * Type predicate that checks whether a `NodeConfig` is a `LocalNodeConfig`.
 * Local nodes are identified by the presence of the `catalogId` property.
 */
export function isLocalNode(node: NodeConfig): node is LocalNodeConfig {
	return 'catalogId' in node;
}

/**
 * Type predicate that checks whether a `NodeConfig` is a `RemoteNodeConfig`.
 * Remote nodes are identified by the presence of the `graphqlUrl` property.
 */
export function isRemoteNode(node: NodeConfig): node is RemoteNodeConfig {
	return 'graphqlUrl' in node;
}
