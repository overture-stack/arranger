import { type IResolvers } from '@graphql-tools/utils';

import { type GetServerSideFilterFn } from '#utils/getDefaultServerSideFilter.js';

import { createResolvers } from './resolvers.js';
import resolveHits from './resolveHits.js';

// TODO: tighten these types
export type CreateConnectionResolversArgs = {
	createStateResolvers?: boolean;
	enableAdmin: boolean;
	getServerSideFilter?: GetServerSideFilterFn;
	Parallel: any;
	type: Record<string, any>;
};

type CreateConnectionResolversFn = (args: CreateConnectionResolversArgs) => IResolvers;

const createConnectionResolvers: CreateConnectionResolversFn = ({
	createStateResolvers = true,
	enableAdmin,
	getServerSideFilter,
	Parallel,
	type,
}) => {
	const { aggregations, hits, configs } = createResolvers({
		createStateResolvers,
		type,
		Parallel,
		getServerSideFilter,
	});

	return {
		[type.name]: {
			aggregations,
			configs,
			hits: resolveHits({ type, Parallel, getServerSideFilter }),
			// keeping this available for backwards compatibility, but hoping to remove it
			// TODO: investigate its current usage and need. remove otherwise
			// Update 2023-02: ENABLE_ADMIN prevents error comes up on facets.
			// `aggregation` vs numericAggregation` cannot be assessed, requires "mapping".
			...(enableAdmin && {
				mapping: async () => {
					return type.mapping;
				},
			}),
		},
	};
};

export default createConnectionResolvers;
