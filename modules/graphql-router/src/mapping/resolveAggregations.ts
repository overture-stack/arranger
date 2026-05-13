import type { GetServerSideFilterFn } from '@overture-stack/arranger-types/configs';
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

/**
 * Replaces all `.` symbols in the keys of an Aggregation Map with `__`.
 * GraphQL fields cannot use the `.` symbol, they may only be alphanumeric or underscores.
 *
 * For example, `donor.age` will become `donor__age`.
 */
const toGraphqlField = (acc: AllAggregationsMap, [a, b]: [string, CommonAggregationProperties]) => ({
	...acc,
	[a.replace(/\./g, '__')]: b,
});

/**
 * Update the AllAggregationsMap to make field names safe for use with GraphQL. All values are unchanged,
 * while all property strings have `.` values replaced with `__` to make them safe for Graphql.
 *
 * For example, `donor.age` will become `donor__age`.
 *
 * Elasticsearch uses dot notation for nested fields, but graphql field names may not use the `.` symbol.
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

		const { esClient } = context;

		// due to this problem in Elasticsearch 6.2 https://github.com/elastic/elasticsearch/issues/27782,
		// we have to resolve set ids into actual ids. As this is an aggregations specific issue,
		// we are placing this here until the issue is resolved by Elasticsearch in version 6.3
		const resolvedFilter = await resolveSetsInSqon({ sqon: filters, esClient });

		const query = buildQuery({
			caller: 'resolveAggregations',
			nestedFieldNames,
			filters: compileFilter({
				clientSideFilter: resolvedFilter,
				serverSideFilter: getServerSideFilter && getServerSideFilter(context),
			}),
		});

		/**
		 * TODO: getFields does not support aliased fields, so we are unable to
		 * serve multiple aggregations of the same type for a given field.
		 * Library issue: https://github.com/robrichard/graphql-fields/issues/18
		 */
		const graphqlFields = getFields(graphqlResolveInfo, {}, { processArguments: true });
		const aggs = buildAggregations({
			query,
			sqon: resolvedFilter,
			graphqlFields,
			nestedFieldNames,
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
		});

		return aggregations;
	};

	return resolver;
};

export default getAggregationsResolver;
