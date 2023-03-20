import { IResolvers } from '@graphql-tools/utils';

import { ConfigProperties } from '@/config/types';
import { GetServerSideFilterFn } from '@/utils/getDefaultServerSideFilter';

import resolveAggregations from './resolveAggregations';
import resolveHits from './resolveHits';

// TODO: tighten these types
type CreateConnectionResolversArgs = {
	createStateResolvers?: boolean;
	enableAdmin: boolean;
	getServerSideFilter?: GetServerSideFilterFn;
	Parallel: any;
	type: Record<string, any>;
};
type CreateConnectionResolversFn = (args: CreateConnectionResolversArgs) => IResolvers;

export type DisplayType = 'all' | 'bits' | 'boolean' | 'bytes' | 'date' | 'list' | 'number';
export interface ExtendedMappingInterface {
	active: boolean; // *
	displayName: string;
	displayType: string;
	displayValues: Record<string, string>;
	fieldName: string;
	isArray: boolean;
	primaryKey: boolean;
	quickSearchEnabled: boolean;
	rangeStep: number | null | undefined;
	type: DisplayType;
	unit: string | null;
}

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
					? type.extendedFields.filter((extendedField: ExtendedMappingInterface) =>
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
