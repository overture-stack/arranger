import { type IResolvers } from '@graphql-tools/utils';
import {
	configRootProperties,
	type ExtendedConfigs,
	type GetServerSideFilterFn,
} from '@overture-stack/arranger-types/configs';
import type Parallel from 'paralleljs';

import { type Resolver, type Root } from '#gqlServer.js';
import type { ArrangerBaseContext } from '#graphqlRoutes.js';

import getAggregationsResolver, { aggregationsToGraphql, type AggregationsResolver } from './resolveAggregations.js';
import resolveHits from './resolveHits.js';

// TODO: tighten these types
export type CreateConnectionResolversArgs<Context extends ArrangerBaseContext> = {
	createStateResolvers?: boolean;
	enableAdmin: boolean;
	getServerSideFilter?: GetServerSideFilterFn<Context>;
	Parallel: typeof Parallel;
	types: Record<string, any>;
};

/**
 * Create the resolvers to retrieve information for the provided search catalog type configs.
 * This will perform seraches against the configured search engine index, returning total hits,
 * or aggregation counts, based on the provided filter.
 *
 * This defines the GraphQL Resolvers for the primary Arranger search funtcionality.
 */
const createConnectionResolvers = <Context extends ArrangerBaseContext>({
	createStateResolvers = true,
	enableAdmin,
	getServerSideFilter,
	Parallel,
	types,
}: CreateConnectionResolversArgs<Context>): IResolvers => {
	/*
	 * Create configs resolver
	 * This will allow querying of the configs that define this Arranger instance.
	 *
	 * TODO: Improve return type for the configs resolver
	 */
	const configs: Resolver<
		Root,
		{ fieldNames: string[] },
		Promise<{ facets?: any; matchbox?: any; table?: any; downloads: any; extended: any }>
	> = async (_unusedParentObj, { fieldNames }) => {
		return {
			downloads: types.config?.[configRootProperties.DOWNLOADS],
			extended: fieldNames
				? types.extendedFields.filter((extendedField: ExtendedConfigs) =>
						fieldNames.includes(extendedField.fieldName),
					)
				: types.extendedFields,
			...(createStateResolvers && {
				charts: types.config?.[configRootProperties.CHARTS],
				facets: types.config?.[configRootProperties.FACETS],
				matchbox: types.config?.[configRootProperties.MATCHBOX],
				table: types.config?.[configRootProperties.TABLE],
			}),
		};
	};

	/**
	 * Create aggregations resolver
	 */
	const aggregationsResolver = getAggregationsResolver({ type: types, getServerSideFilter });

	const aggregations: AggregationsResolver<Context> = async (obj, args, context, info) => {
		const aggregations = await aggregationsResolver(obj, args, context, info);
		return aggregationsToGraphql(aggregations);
	};

	/**
	 * Create hits resolver
	 */
	const hits = resolveHits({ type: types, Parallel, getServerSideFilter });

	const connectionResolver = {
		[types.name]: {
			aggregations,
			configs,
			hits,

			// keeping this available for backwards compatibility, but hoping to remove it
			// TODO: investigate its current usage and need. remove otherwise
			// Update 2023-02: ENABLE_ADMIN prevents error comes up on facets.
			// `aggregation` vs numericAggregation` cannot be assessed, requires "mapping".
			...(enableAdmin && {
				mapping: async () => {
					return types.mapping;
				},
			}),
		},
	};

	return connectionResolver;
};

export default createConnectionResolvers;
