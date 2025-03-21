import { ConfigProperties, ExtendedConfigsInterface } from '@/config/types';
import { Resolver, Root } from '@/gqlServer';
import { CreateConnectionResolversArgs } from './createConnectionResolvers';
import { applyAggregationMasking } from './masking';
import getAggregationsResolver, {
	AggregationsResolver,
	aggregationsToGraphql,
} from './resolveAggregations';
import resolveHits from './resolveHits';
import { getHitsFromAggsResolver } from './resolveHitsFromAggs';

export const createResolvers = ({
	createStateResolvers,
	type,
	Parallel,
	getServerSideFilter,
	enableDocumentHits,
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
			const { dataMaskedAggregations } = applyAggregationMasking({
				aggregations,
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
		: getHitsFromAggsResolver(aggregationsResolver);

	return { hits, aggregations, configs };
};
