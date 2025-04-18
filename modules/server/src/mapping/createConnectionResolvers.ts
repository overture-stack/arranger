import { type IResolvers } from '@graphql-tools/utils';

import { ConfigProperties, type ExtendedConfigsInterface } from '#config/types.js';
import { type GetServerSideFilterFn } from '#utils/getDefaultServerSideFilter.js';

import resolveAggregations from './resolveAggregations.js';
import resolveHits from './resolveHits.js';

// TODO: tighten these types
type CreateConnectionResolversArgs = {
	createStateResolvers?: boolean;
	enableAdmin: boolean;
	getServerSideFilter?: GetServerSideFilterFn;
	Parallel: any;
	type: Record<string, any>;
};
type CreateConnectionResolversFn = (args: CreateConnectionResolversArgs) => IResolvers;

const createConnectionResolvers: CreateConnectionResolversFn = ({
	createStateResolvers = true,
	enableAdmin,
	getServerSideFilter,
	Parallel,
	type,
}) => ({
	[type.name]: {
		aggregations: resolveAggregations({ type, getServerSideFilter }),
		configs: async (parentObj, { fieldNames }: { fieldNames: string[] }) => {
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
		},
		hits: resolveHits({ type, Parallel, getServerSideFilter }),
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
});

export default createConnectionResolvers;
