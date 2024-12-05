import { ConfigProperties, ExtendedConfigsInterface } from '@/config/types';
import { get } from 'lodash';
import { applyAggregationMasking } from './masking';
import resolveAggregations, { aggregationsToGraphql } from './resolveAggregations';
import resolveHits from './resolveHits';

/**
 * Resolve hits from aggregations
 * If "aggregations" field is not in query, return 0
 *
 * @param aggregationsQuery - resolver ES query code for aggregations
 * @returns Returns a total count that is less than or equal to the actual total hits in the query.
 */
const resolveHitsFromAggs =
	(aggregationsQuery, dataMaskThreshold) => async (obj, args, context, info) => {
		/*
		 * Get "aggregations" field from full query if found
		 * Popular gql parsing libs parse the "info" property which may not include full query based on schema
		 */
		const aggregationsPath = 'operation.selectionSet.selections[0].selectionSet.selections';
		const aggregationsSelectionSet = get(info, aggregationsPath, []).find(
			(selection) => selection.name.value === 'aggregations',
		);

		if (aggregationsSelectionSet) {
			const modifiedInfo = { ...info, fieldNodes: [aggregationsSelectionSet] };
			const aggregations = await aggregationsQuery(obj, info.variableValues, context, modifiedInfo);
			const { hitsTotal: total } = applyAggregationMasking({
				aggregations,
				thresholdMin: dataMaskThreshold,
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
	dataMaskThreshold,
	enableDocumentHits,
}) => {
	// configs
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

	// aggregations
	const aggregationsQuery = resolveAggregations({ type, getServerSideFilter });

	const aggregations = async (obj, args, context, info) => {
		const aggs = await aggregationsQuery(obj, args, context, info);
		return aggregationsToGraphql(aggs);
	};

	// hits
	const defaultHitsResolver = resolveHits({ type, Parallel, getServerSideFilter });
	const hits = enableDocumentHits
		? defaultHitsResolver
		: resolveHitsFromAggs(aggregationsQuery, dataMaskThreshold);

	return { hits, aggregations, configs };
};
