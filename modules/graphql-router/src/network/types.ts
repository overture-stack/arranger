import type { AggregationsResolver } from '#mapping/resolveAggregations.js';
import type { ArrangerBaseContext, Resolver } from '#types.js';

import type { AggregationField } from './types/setup.js';

export type LocalCatalogueSchemaData<Context extends ArrangerBaseContext> = {
	catalogId: string;
	configs: {
		aggregations: AggregationField[];
	};
	resolvers: {
		aggregations: AggregationsResolver<Context>;
		hits: Resolver<any, any, any, Context>;
	};
};
