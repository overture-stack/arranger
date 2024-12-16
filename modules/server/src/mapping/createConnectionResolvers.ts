import { IResolvers } from '@graphql-tools/utils';

import { GetServerSideFilterFn } from '@/utils/getDefaultServerSideFilter';

import { createResolvers } from './resolvers';

// TODO: tighten these types
export type CreateConnectionResolversArgs = {
	createStateResolvers?: boolean;
	enableAdmin: boolean;
	enableDocumentHits: boolean;
	getServerSideFilter?: GetServerSideFilterFn;
	Parallel: any;
	type: Record<string, any>;
};
type CreateConnectionResolversFn = (args: CreateConnectionResolversArgs) => IResolvers;

const createConnectionResolvers: CreateConnectionResolversFn = ({
	createStateResolvers = true,
	enableAdmin,
	enableDocumentHits,
	getServerSideFilter,
	Parallel,
	type,
}) => {
	const { aggregations, hits, configs } = createResolvers({
		createStateResolvers,
		type,
		Parallel,
		getServerSideFilter,
		enableDocumentHits,
	});

	return {
		[type.name]: {
			aggregations,
			configs,
			hits,
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
