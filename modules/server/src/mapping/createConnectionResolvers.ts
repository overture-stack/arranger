import { IResolvers } from '@graphql-tools/utils';

import { ConfigProperties, ExtendedConfigsInterface } from '@/config/types';
import { GetServerSideFilterFn } from '@/utils/getDefaultServerSideFilter';

import { parseResolveInfo } from 'graphql-parse-resolve-info';
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
	const aggregationsResolver = (obj, args, context, info) => {
		const aggs = aggregationsQuery(obj, args, context, info);
		console.log('queried', JSON.stringify(aggs));
		return aggregationsToGraphql(aggs);
	};

	const defaultHitsResolver = resolveHits({ type, Parallel, getServerSideFilter });
	const hitsResolver = enableDocumentHits
		? defaultHitsResolver
		: async (obj, args, context, info) => {
				console.log('alt hits');
				const parsedResolveInfo = parseResolveInfo(info);
				console.log('parsed', JSON.stringify(parsedResolveInfo));

				// TODO:
				// IF query is querying aggregations
				// calculate hits based on data masked values
				// otherwise return 0

				return { total: 0 };
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
