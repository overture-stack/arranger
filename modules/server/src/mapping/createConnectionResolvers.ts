import { IResolvers } from '@graphql-tools/utils';

import { ConfigProperties, ExtendedConfigsInterface } from '@/config/types';
import { GetServerSideFilterFn } from '@/utils/getDefaultServerSideFilter';

import { applyAggregationMasking } from './masking';
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

	const aggregationsQuery = resolveAggregations({ type, getServerSideFilter });
	const aggregationsResolver = async (obj, args, context, info) => {
		const aggs = await aggregationsQuery(obj, args, context, info);
		return aggregationsToGraphql(aggs);
	};

	// hits resolver doesnt have access to aggregations field
	const defaultHitsResolver = resolveHits({ type, Parallel, getServerSideFilter });
	const hitsResolver = enableDocumentHits
		? defaultHitsResolver
		: resolveHitsFromAggs(aggregationsQuery);

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

/**
 * Resolve hits from aggregations
 * If "aggregations" field is not in query, return 0
 *
 * @param aggregationsQuery - resolver ES query code for aggregations
 * @returns Returns a total count that is less than or equal to the actual total hits in the query.
 */
const resolveHitsFromAggs = (aggregationsQuery) => async (obj, args, context, info) => {
	/*
	 * Get "aggregations" field from full query if found
	 * Popular gql parsing libs parse the "info" property which may not include full query based on schema
	 */
	const fileNameConnectionProperty = info.operation.selectionSet.selections[0];
	const aggregationsSelectionSet = fileNameConnectionProperty.selectionSet.selections.find(
		(selection) => selection.name.value === 'aggregations',
	);

	if (aggregationsSelectionSet) {
		const modifiedInfo = { ...info, fieldNodes: [aggregationsSelectionSet] };
		const aggregations = await aggregationsQuery(obj, info.variableValues, context, modifiedInfo);
		const { hitsTotal: total } = applyAggregationMasking({
			aggregations,
			thresholdMin: 200,
		});
		return { total };
	} else {
		return { total: 0 };
	}
};

export default createConnectionResolvers;
