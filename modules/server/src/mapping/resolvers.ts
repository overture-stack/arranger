import { configProperties, type ExtendedConfigs } from '#config/types.js';
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
			downloads: type.config?.[configProperties.DOWNLOADS],
			extended: fieldNames
				? type.extendedFields.filter((extendedField: ExtendedConfigs) =>
						fieldNames.includes(extendedField.fieldName),
					)
				: type.extendedFields,
			...(createStateResolvers && {
				facets: type.config?.[configProperties.FACETS],
				matchbox: type.config?.[configProperties.MATCHBOX],
				table: type.config?.[configProperties.TABLE],
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
