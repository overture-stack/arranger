import type { GetServerSideFilterFn } from '@overture-stack/arranger-types/configs';
import { configOptionalProperties } from '@overture-stack/arranger-types/configs/constants';
import { sanitizeGraphqlFlatName } from '@overture-stack/arranger-types/tools';
import getFields from 'graphql-fields';

import { buildAggregations, buildQuery, flattenAggregations } from '#middleware/index.js';
import type { SchemaTypesDefinition } from '#schema/types.js';
import type { ArrangerBaseContext, Resolver, Root } from '#types.js';

import { resolveSetsInSqon } from './hackyTemporaryEsSetResolution.js';
import compileFilter from './utils/compileFilter.js';
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
	getServerSideFilter?: GetServerSideFilterFn<Context>;
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

		// due to this problem in Elasticsearch 6.2 https://github.com/elastic/elasticsearch/issues/27782,
		// we have to resolve set ids into actual ids. As this is an aggregations specific issue,
		// we are placing this here until the issue is resolved by Elasticsearch in version 6.3
		const resolvedFilter = await resolveSetsInSqon({ sqon: filters, esClient });

		const serverSideFilter = getServerSideFilter && getServerSideFilter(context);

		const query = buildQuery({
			caller: 'resolveAggregations',
			nestedFieldNames,
			nestingPrefix,
			filters: compileFilter({
				clientSideFilter: resolvedFilter,
				serverSideFilter,
			}),
		});

		/**
		 * Compiled on its own, and kept apart from `query`, because aggregations wrapped in an ES
		 * `global` aggregation ignore the search query entirely and have their constraints rebuilt
		 * from the query minus the aggregated field's clauses. That rebuild cannot tell the caller's
		 * filter from the access-control filter once `compileFilter` has merged them, so it drops
		 * both. Passing the server-side half separately is what lets `buildAggregations` put it back.
		 */
		const serverSideQuery = buildQuery({
			caller: 'resolveAggregations',
			nestedFieldNames,
			nestingPrefix,
			filters: serverSideFilter,
		});

		/**
		 * TODO: getFields does not support aliased fields, so we are unable to
		 * serve multiple aggregations of the same type for a given field.
		 * Library issue: https://github.com/robrichard/graphql-fields/issues/18
		 */
		const graphqlFields = getFields(graphqlResolveInfo, {}, { processArguments: true });
		const aggs = buildAggregations({
			query,
			serverSideQuery,
			sqon: resolvedFilter,
			graphqlFields,
			nestedFieldNames,
			nestingPrefix,
			// Aggregation names flatten a whole dotted path into one GraphQL name, so recovering the
			// Elasticsearch path takes the registry rather than a string transform.
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
