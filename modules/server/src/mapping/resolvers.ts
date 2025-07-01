import { ConfigProperties, type ExtendedConfigsInterface } from '#config/types.js';
import { type Resolver, type Root } from '#gqlServer.js';

import { type CreateConnectionResolversArgs } from './createConnectionResolvers.js';
import getAggregationsResolver, { type AggregationsResolver, aggregationsToGraphql } from './resolveAggregations.js';

export const createResolvers = ({
	createStateResolvers,
	type,
	Parallel,
	getServerSideFilter,
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
				charts: type.config?.[ConfigProperties.CHARTS],
				facets: type.config?.[ConfigProperties.FACETS],
				matchbox: type.config?.[ConfigProperties.MATCHBOX],
				table: type.config?.[ConfigProperties.TABLE],
			}),
		};
	};

	/**
	 * aggregations
	 * return resolver with document hits
	 */
	const aggregationsResolver = getAggregationsResolver({ type, getServerSideFilter });

	const aggregations: AggregationsResolver = async (obj, args, context, info) => {
		const aggregations = await aggregationsResolver(obj, args, context, info);
		return aggregationsToGraphql(aggregations);
	};

	return { aggregations, configs };
};
