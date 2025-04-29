import { ConfigProperties, type ExtendedConfigsInterface } from '#config/types.js';
import { type Resolver, type Root } from '#gqlServer.js';

import { type CreateConnectionResolversArgs } from './createConnectionResolvers.js';
import { applyAggregationMasking } from './masking.js';
import getAggregationsResolver, { type AggregationsResolver, aggregationsToGraphql } from './resolveAggregations.js';
import resolveHits from './resolveHits.js';
import { getHitsFromAggsResolver } from './resolveHitsFromAggs.js';

export const createResolvers = ({
	createStateResolvers,
	type,
	Parallel,
	getServerSideFilter,
	enableDocumentHits,
	dataMaskMinThreshold,
}: Omit<CreateConnectionResolversArgs, 'enableAdmin'>) => {
	const configs: Resolver<
		Root,
		{ fieldNames: string[] },
		Promise<{ facets?: any; matchbox?: any; table?: any; downloads: any; extended: any }>
	> = async (_unusedParentObj, { fieldNames }) => {
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

	/**
	 * aggregations
	 * return resolver with document hits or data masking applied
	 */
	const aggregationsResolver = getAggregationsResolver({ type, getServerSideFilter });

	const aggregations: AggregationsResolver = async (obj, args, context, info) => {
		const aggregations = await aggregationsResolver(obj, args, context, info);
		if (enableDocumentHits) {
			return aggregationsToGraphql(aggregations);
		} else {
			// TODO: Needs further validation and testing before full release, see implementation for detail
			const { dataMaskedAggregations } = applyAggregationMasking({
				aggregations,
				dataMaskMinThreshold,
			});
			return aggregationsToGraphql(dataMaskedAggregations);
		}
	};

	/**
	 * hits
	 * return resolver with hits from ES or hits calculated from aggregations
	 */
	const hits = enableDocumentHits
		? resolveHits({ type, Parallel, getServerSideFilter })
		: getHitsFromAggsResolver(aggregationsResolver, dataMaskMinThreshold);

	return { hits, aggregations, configs };
};
