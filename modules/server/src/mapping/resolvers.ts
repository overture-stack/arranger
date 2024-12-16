import { get } from 'lodash';

import { ConfigProperties, ExtendedConfigsInterface } from '@/config/types';
import { Resolver } from '@/gqlServer';
import { CreateConnectionResolversArgs } from './createConnectionResolvers';
import { applyAggregationMasking } from './masking';
import resolveAggregations, {
	Aggregations,
	aggregationsToGraphql,
	GQLAggregationQueryFilters,
} from './resolveAggregations';
import resolveHits from './resolveHits';
import { HitsQuery } from './types';

type Root = Record<string, any>;

type HitsResolver = Resolver<Root, HitsQuery, Promise<{ total: number }>>;
type AggregationsResolver = Resolver<Root, GQLAggregationQueryFilters, Promise<Aggregations>>;

/**
 * Calculate hits from aggregation data, not using "hits" ES response field
 * If "aggregations" field is not in query, return 0 for hits
 *
 * @param aggregationsQuery - resolver ES query code for aggregations
 * @returns Returns a total count that is less than or equal to the actual total hits in the query.
 */
const resolveHitsFromAggs: (aggregationsQuery: AggregationsResolver) => HitsResolver = (
	aggregationsQuery,
) => {
	const resolver: HitsResolver = async (obj, args, context, info) => {
		/*
		 * Get "aggregations" field from full query if found
		 * Popular gql parsing libs parse the "info" property which may not include full query based on schema
		 */
		const aggregationsPath = 'operation.selectionSet.selections[0].selectionSet.selections';
		const aggregationsSelectionSet = get(info, aggregationsPath, []).find(
			(selection: { kind: string; name: { value: string } }) =>
				selection.kind === 'Field' && selection.name.value === 'aggregations',
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
	return resolver;
};

export const createResolvers = ({
	createStateResolvers,
	type,
	Parallel,
	getServerSideFilter,
	enableDocumentHits,
}: Omit<CreateConnectionResolversArgs, 'enableAdmin'>) => {
	// configs
	// TODO: tighten return value type
	const configs: Resolver<Root, { fieldNames: string[] }, any> = async (
		_unusedParentObj,
		{ fieldNames },
	) => {
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
	// @ts-expect-error - tighten types higher up, "type"
	const aggregationsQuery = resolveAggregations({ type, getServerSideFilter });

	const aggregations: AggregationsResolver = async (obj, args, context, info) => {
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
	const hits = enableDocumentHits ? defaultHitsResolver : resolveHitsFromAggs(aggregationsQuery);

	return { hits, aggregations, configs };
};
