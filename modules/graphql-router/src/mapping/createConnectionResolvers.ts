import { type IResolvers } from '@graphql-tools/utils';
import {
	configRootProperties,
	type ExtendedConfigs,
	type GetServerSideFilterFn,
} from '@overture-stack/arranger-types/configs';
import type Parallel from 'paralleljs';

import type { SchemaTypesDefinition } from '#schema/types.js';
import type { ArrangerBaseContext, Resolver, Root } from '#types.js';

import getAggregationsResolver, { aggregationsToGraphql, type AggregationsResolver } from './resolveAggregations.js';
import resolveHits from './resolveHits.js';

// TODO: tighten these types

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
	type,
}: {
	createStateResolvers?: boolean;
	enableAdmin: boolean;
	getServerSideFilter?: GetServerSideFilterFn<Context>;
	Parallel: Parallel<any>;
	type: SchemaTypesDefinition;
}): IResolvers<any, Context> => {
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
			downloads: type.config?.[configRootProperties.DOWNLOADS],
			extended: fieldNames
				? type.extendedFields.filter((extendedField: ExtendedConfigs) =>
						fieldNames.includes(extendedField.fieldName),
					)
				: type.extendedFields,
			...(createStateResolvers && {
				charts: type.config?.[configRootProperties.CHARTS],
				facets: type.config?.[configRootProperties.FACETS],
				matchbox: type.config?.[configRootProperties.MATCHBOX],
				table: type.config?.[configRootProperties.TABLE],
			}),
		};
	};

	/**
	 * Create aggregations resolver
	 */
	const aggregationsResolver = getAggregationsResolver({ type, getServerSideFilter });

	const aggregations: AggregationsResolver<Context> = async (obj, args, context, info) => {
		const aggregations = await aggregationsResolver(obj, args, context, info);
		return aggregationsToGraphql(aggregations);
	};

	/**
	 * Create hits resolver
	 */
	const hits = resolveHits({ type, Parallel, getServerSideFilter });

	const connectionResolver = {
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

	return connectionResolver;
};

export default createConnectionResolvers;
