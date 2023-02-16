import { ConfigProperties } from '@/config/types';
import { GetServerSideFilterFn } from '@/utils/getDefaultServerSideFilter';

import resolveAggregations from './resolveAggregations';
import resolveHits from './resolveHits';

// TODO: tighten these types
type TcreateConnectionResolversArgs = {
	createStateResolvers?: boolean;
	enableAdmin: boolean;
	getServerSideFilter?: GetServerSideFilterFn;
	Parallel: any;
	type: Record<string, any>;
};
type TcreateConnectionResolvers = (args: TcreateConnectionResolversArgs) => Record<string, any>;

const createConnectionResolvers: TcreateConnectionResolvers = ({
	createStateResolvers = true,
	enableAdmin,
	getServerSideFilter,
	Parallel,
	type,
}) => ({
	[type.name]: {
		aggregations: resolveAggregations({ type, getServerSideFilter }),
		configs: async (obj, { fieldNames }, ctx) => {
			return {
				downloads: type.config?.[ConfigProperties.DOWNLOADS],
				extended: fieldNames
					? type.extendedFields.filter((extendedField) =>
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
