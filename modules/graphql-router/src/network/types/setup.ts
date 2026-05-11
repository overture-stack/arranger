import type { LocalNodeConfig, RemoteNodeConfig } from '@overture-stack/arranger-types/configs';

import type { Resolver } from '#gqlServer.js';
import type { ArrangerBaseContext } from '#graphqlRoutes.js';
import type { AggregationsResolver } from '#mapping/resolveAggregations.js';
import type { SearchClient } from '#searchClient/index.js';

export type AggregationField = { name: string; type: string };

export type NetworkRemoteNode = RemoteNodeConfig & {
	aggregations: AggregationField[];
};
export type NetworkLocalNode<Context extends ArrangerBaseContext> = LocalNodeConfig & {
	aggregations: AggregationField[];
	resolvers: {
		aggregations: AggregationsResolver<Context>;
		hits: Resolver<any, any, any, Context>; // TODO: Hits Resolver is not in a typed file, it is of type Resolver<?,?,?,Context>
	};
	searchClient: SearchClient;
};
export type NetworkNode<Context extends ArrangerBaseContext> = NetworkLocalNode<Context> | NetworkRemoteNode;
