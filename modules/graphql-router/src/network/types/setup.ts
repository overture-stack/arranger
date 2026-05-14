import type { LocalNodeConfig, RemoteNodeConfig } from '@overture-stack/arranger-types/configs';

import type { ArrangerBaseContext, Resolver } from '#types.js';

export type AggregationField = { name: string; type: string };

export type NetworkRemoteNode = RemoteNodeConfig & {
	aggregations: AggregationField[];
};
export type NetworkLocalNode<Context extends ArrangerBaseContext> = LocalNodeConfig & {
	aggregations: AggregationField[];
	resolvers: { aggregations: Resolver<any, any, any, Context>; hits: Resolver<any, any, any, Context> };
};
export type NetworkNode<Context extends ArrangerBaseContext> = NetworkLocalNode<Context> | NetworkRemoteNode;
