import { type IResolvers } from '@graphql-tools/utils';

import { type GetServerSideFilterFn } from '#utils/getDefaultServerSideFilter.js';

import { createResolvers } from './resolvers.js';

// TODO: tighten these types
export type CreateConnectionResolversArgs = {
	createStateResolvers?: boolean;
	enableAdmin: boolean;
	enableDocumentHits: boolean;
	dataMaskMinThreshold: number;
	getServerSideFilter?: GetServerSideFilterFn;
	Parallel: any;
	type: Record<string, any>;
};

type CreateConnectionResolversFn = (args: CreateConnectionResolversArgs) => IResolvers;

const createConnectionResolvers: CreateConnectionResolversFn = ({
	createStateResolvers = true,
	enableAdmin,
	enableDocumentHits,
	dataMaskMinThreshold,
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
		dataMaskMinThreshold,
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
