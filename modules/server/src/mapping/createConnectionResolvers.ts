import { IResolvers } from '@graphql-tools/utils';

import { ConfigProperties, ExtendedConfigsInterface } from '@/config/types';
import { GetServerSideFilterFn } from '@/utils/getDefaultServerSideFilter';

import { parseResolveInfo } from 'graphql-parse-resolve-info';
import { calculateHitsFromAggregations } from './masking';
import resolveAggregations, { aggregationsToGraphql } from './resolveAggregations';
import resolveHits from './resolveHits';

// TODO: tighten these types
type CreateConnectionResolversArgs = {
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
	const configs = async (parentObj, { fieldNames }: { fieldNames: string[] }) => {
		return {
			downloads: type.config?.[ConfigProperties.DOWNLOADS],
			extended: fieldNames
				? type.extendedFields.filter((extendedField: ExtendedConfigsInterface) =>
						fieldNames.includes(extendedField.fieldName),
				  )
				: type.extendedFields,
			...(createStateResolvers && {
				facets: type.config?.[ConfigProperties.FACETS],
				matchbox: type.config?.[ConfigProperties.MATCHBOX],
				table: type.config?.[ConfigProperties.TABLE],
			}),
		};
	};

	// TODO: memoise instead of context
	// just same request really - maybe  JSON.stringify
	const aggregationsQuery = resolveAggregations({ type, getServerSideFilter });
	const aggregationsResolver = async (obj, args, context, info) => {
		const aggs = await aggregationsQuery(obj, args, context, info);
		return aggregationsToGraphql(aggs);
	};

	const defaultHitsResolver = resolveHits({ type, Parallel, getServerSideFilter });
	const hitsResolver = enableDocumentHits
		? defaultHitsResolver
		: async (obj, args, context, info) => {
				/*
				 * Checks for aggregations field in full query and retrieves args
				 * Popular parsing `info` libs do not include these operations properties
				 */
				const typeNameConnectionProperty = info.operation.selectionSet.selections[0];
				const isAggregationsQueried = typeNameConnectionProperty.selectionSet.selections.some(
					(selection) => selection.name.value === 'aggregations',
				);

				/*
				 * Calculate "hits" based on aggregations otherwise return 0
				 */
				if (isAggregationsQueried) {
					// other args are ok to pass through as they share context and parent field
					const aggregations = await aggregationsQuery(obj, info.variableValues, context, info);
					const total = calculateHitsFromAggregations({ aggregations });
					return { total };
				} else {
					return { total: 0 };
				}
		  };

	return {
		[type.name]: {
			aggregations: aggregationsResolver,
			configs,
			hits: hitsResolver,
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
