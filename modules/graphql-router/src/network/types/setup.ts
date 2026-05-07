import type { LocalNodeConfig, RemoteNodeConfig } from '@overture-stack/arranger-types/configs';

export type AggregationField = { name: string; type: string };

export type NetworkRemoteNode = RemoteNodeConfig & {
	aggregations: AggregationField[];
};
export type NetworkLocalNode = LocalNodeConfig & {
	aggregations: AggregationField[];
};
export type NetworkNode = NetworkLocalNode | NetworkRemoteNode;
