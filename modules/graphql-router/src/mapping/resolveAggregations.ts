import type { GetServerSideFilterFn } from '@overture-stack/arranger-types/configs';
import { configOptionalProperties } from '@overture-stack/arranger-types/configs/constants';
import { sanitizeGraphqlFlatName } from '@overture-stack/arranger-types/tools';
import getFields from 'graphql-fields';

import { evaluateFilterCallback } from '#accessControl/filterCallback.js';
import { buildAggregations, buildQuery, flattenAggregations } from '#middleware/index.js';
import type { SchemaTypesDefinition } from '#schema/types.js';
import type { ArrangerBaseContext, Resolver, Root } from '#types.js';

import compileFilter, { applicableClientFilter } from './utils/compileFilter.js';
import esSearch from './utils/esSearch.js';

export type Bucket = {
	doc_count: number;
	key: string;
};

export type CommonAggregationProperties = {
	bucket_count: number;
	buckets: Bucket[];
};

// the GQL Aggregations type
export type Aggregations = CommonAggregationProperties;

type Stats = {
	max: number;
	min: number;
	count: number;
	avg: number;
	sum: number;
};

// the GQL NumericAggregations type
export type NumericAggregations = { stats: Stats } & CommonAggregationProperties;

// "Aggregations" plural is already a name for a field type that has aggregations
export type AllAggregations = Aggregations | NumericAggregations;
export type AllAggregationsMap = Record<string, Aggregations | NumericAggregations>;

export type AggregationsResolver<Context extends ArrangerBaseContext> = Resolver<
	Root,
	AggregationsQueryVariables,
	Promise<AllAggregationsMap>,
	Context
>;

export type AggregationsQueryVariables = {
	filters: any;
	aggregations_filter_themselves: boolean;
	include_missing: boolean;
};

/** Renames one Aggregation Map key from its raw ES field path to its GraphQL-safe name (see `sanitizeGraphqlFlatName`), e.g. `donor.age` becomes `donor__age`. */
const toGraphqlField = (acc: AllAggregationsMap, [a, b]: [string, CommonAggregationProperties]) => ({
	...acc,
	[sanitizeGraphqlFlatName(a)]: b,
});

/**
 * Update the AllAggregationsMap to make field names safe for use with GraphQL. All values are
 * unchanged; every property key is renamed to its GraphQL-safe name via `sanitizeGraphqlFlatName`,
 * the same rule the schema itself was built with, so a query's aggregation keys always match.
 */
export const aggregationsToGraphql = (aggregations: AllAggregationsMap): AllAggregationsMap => {
	return Object.entries(aggregations).reduce<AllAggregationsMap>(toGraphqlField, {});
};

const getAggregationsResolver = <Context extends ArrangerBaseContext>({
	type,
	getServerSideFilter,
}: {
	type: SchemaTypesDefinition;
	getServerSideFilter: GetServerSideFilterFn<Context>;
}) => {
	const resolver: AggregationsResolver<Context> = async (
		root,
		{ filters, aggregations_filter_themselves, include_missing = true },
		context,
		graphqlResolveInfo,
	) => {
		const nestedFieldNames = type.nested_fieldNames;
		const nestingPrefix = type.config?.[configOptionalProperties.NESTING_PREFIX];

		const { esClient } = context;

		const serverSideFilter = evaluateFilterCallback({ context, getServerSideFilter });

		const query = buildQuery({
			caller: 'resolveAggregations',
			nestedFieldNames,
			nestingPrefix,
			filters: compileFilter({
				clientSideFilter: filters,
				disableClientFilters: context.disableClientFilters,
				serverSideFilter,
			}),
			setsIndex: type.setsIndex,
		});

		/**
		 * Each half compiled on its own, and kept apart from `query`, because aggregations wrapped in an
		 * ES `global` aggregation ignore the search query and have their constraints rebuilt: the
		 * caller's filter less the aggregated field's clauses, beside the access-control filter whole.
		 * Once `compileFilter` has merged them, the rebuild could not tell one from the other.
		 */
		const clientSideQuery = buildQuery({
			caller: 'resolveAggregations',
			nestedFieldNames,
			nestingPrefix,
			filters: applicableClientFilter({
				clientSideFilter: filters,
				disableClientFilters: context.disableClientFilters,
			}),
			setsIndex: type.setsIndex,
		});

		const serverSideQuery = buildQuery({
			caller: 'resolveAggregations',
			nestedFieldNames,
			nestingPrefix,
			filters: serverSideFilter,
			setsIndex: type.setsIndex,
		});

		/**
		 * TODO: getFields does not support aliased fields, so we are unable to
		 * serve multiple aggregations of the same type for a given field.
		 * Library issue: https://github.com/robrichard/graphql-fields/issues/18
		 */
		const graphqlFields = getFields(graphqlResolveInfo, {}, { processArguments: true });
		const aggs = buildAggregations({
			clientSideQuery,
			disableClientFilters: context.disableClientFilters,
			serverSideQuery,
			setsIndex: type.setsIndex,
			sqon: filters,
			graphqlFields,
			nestedFieldNames,
			nestingPrefix,
			// Recovering the ES path from a flattened aggregation name takes the registry, not a
			// string transform.
			rawPathsByGraphqlFlatName: type.graphqlNameRegistry?.rawPathsByGraphqlFlatName,
			aggregationsFilterThemselves: aggregations_filter_themselves,
		});

		const body = {
			...(Object.keys(query || {}).length && { query }),
			aggs,
		};

		const response = await esSearch(esClient)({
			index: type.index,
			size: 0,
			_source: false,
			body,
		});

		const aggregations = flattenAggregations({
			aggregations: response?.body?.aggregations,
			includeMissing: include_missing,
			nestingPrefix,
		});

		return aggregations;
	};

	return resolver;
};

export default getAggregationsResolver;
