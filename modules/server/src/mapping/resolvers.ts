import { ConfigProperties, ExtendedConfigsInterface } from '@/config/types';
import { GraphQLResolveInfo } from 'graphql';
import { get } from 'lodash';
import { CreateConnectionResolversArgs } from './createConnectionResolvers';
import { applyAggregationMasking } from './masking';
import resolveAggregations, { aggregationsToGraphql } from './resolveAggregations';
import resolveHits from './resolveHits';
import { Aggregation, Context, Hits, Root } from './types';

/**
 * Resolve hits from aggregations
 * If "aggregations" field is not in query, return 0
 *
 * @param aggregationsQuery - resolver ES query code for aggregations
 * @returns Returns a total count that is less than or equal to the actual total hits in the query.
 */
const resolveHitsFromAggs =
	(
		aggregationsQuery: (
			obj: Root,
			args: {
				filters?: object;
				include_missing?: boolean;
				aggregations_filter_themselves?: boolean;
			},
			context: Context,
			info: GraphQLResolveInfo,
		) => Record<string, Aggregation>,
	) =>
	async (obj: Root, args: Hits, context: Context, info: GraphQLResolveInfo) => {
		/*
		 * Get "aggregations" field from full query if found
		 * Popular gql parsing libs parse the "info" property which may not include full query based on schema
		 */
		const aggregationsPath = 'operation.selectionSet.selections[0].selectionSet.selections';
		const aggregationsSelectionSet = get(info, aggregationsPath, []).find(
			(selection) => selection.kind === 'Field' && selection.name.value === 'aggregations',
		);

		/*
		 * This function is used for "aggregation only mode" of Arranger where "hits" is based on "aggregations"
		 * A user might request only the "hits" field in a GQL query, in which case return 0
		 */
		if (aggregationsSelectionSet) {
			const modifiedInfo = { ...info, fieldNodes: [aggregationsSelectionSet] };
			// @ts-ignore
			// modifying the query info field inline so it can query aggregations correctly
			// not idiomatic so doesn't line up with typings from graphql
			const aggregations = await aggregationsQuery(obj, info.variableValues, context, modifiedInfo);
			const { hitsTotal: total, dataMaskedAggregations } = applyAggregationMasking({
				aggregations,
			});
			return { total };
		} else {
			return { total: 0 };
		}
	};

export const createResolvers = ({
	createStateResolvers,
	type,
	Parallel,
	getServerSideFilter,
	enableDocumentHits,
}: Omit<CreateConnectionResolversArgs, 'enableAdmin'>) => {
	// configs
	const configs = async (parentObj: Root, { fieldNames }: { fieldNames: string[] }) => {
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

	// aggregations
	const aggregationsQuery = resolveAggregations({ type, getServerSideFilter });

	const aggregations = async (
		obj: Root,
		args: {
			filters: object;
			include_missing: boolean;
			aggregations_filter_themselves: boolean;
		},
		context: Context,
		info: GraphQLResolveInfo,
	) => {
		const aggregations = await aggregationsQuery(obj, args, context, info);
		if (enableDocumentHits) {
			return aggregationsToGraphql(aggregations);
		} else {
			const { dataMaskedAggregations } = applyAggregationMasking({
				aggregations,
			});
			return aggregationsToGraphql(dataMaskedAggregations);
		}
	};

	// hits
	const defaultHitsResolver = resolveHits({ type, Parallel, getServerSideFilter });
	const hits = enableDocumentHits
		? defaultHitsResolver
		: // @ts-ignore
		  // typing resolveAggregations requires typing a lot of code down the chain
		  // TODO: improve typing
		  resolveHitsFromAggs(aggregationsQuery);

	return { hits, aggregations, configs };
};
