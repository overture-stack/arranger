import { type IResolvers } from '@graphql-tools/utils';
import { type GetServerSideFilterFn } from '@overture-stack/arranger-types/configs';

import resolveHits from './resolveHits.js';
import { createResolvers } from './resolvers.js';

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
	const { aggregations, configs } = createResolvers({
		createStateResolvers,
		type,
		Parallel,
		getServerSideFilter,
	});

	const connectionResolver = {
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

	return connectionResolver;
};

export default createConnectionResolvers;
