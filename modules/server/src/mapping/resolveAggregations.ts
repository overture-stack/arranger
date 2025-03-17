import getFields from 'graphql-fields';

import { Resolver, Root } from '@/gqlServer';
import { GetServerSideFilterFn } from '@/utils/getDefaultServerSideFilter';
import { buildAggregations, buildQuery, flattenAggregations } from '../middleware';
import { resolveSetsInSqon } from './hackyTemporaryEsSetResolution';
import { Relation } from './masking';
import compileFilter from './utils/compileFilter';
import esSearch from './utils/esSearch';

export type Bucket = {
	doc_count: number;
	key: string;
	relation: Relation;
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

export type AggregationsResolver = Resolver<
	Root,
	AggregationsQueryVariables,
	Promise<AllAggregationsMap>
>;

export type AggregationsQueryVariables = {
	filters: any;
	aggregations_filter_themselves: boolean;
	include_missing: boolean;
};

const toGraphqlField = (
	acc: AllAggregationsMap,
	[a, b]: [string, CommonAggregationProperties],
) => ({
	...acc,
	[a.replace(/\./g, '__')]: b,
});

export const aggregationsToGraphql = (aggregations: AllAggregationsMap) => {
	return Object.entries(aggregations).reduce<AllAggregationsMap>(toGraphqlField, {});
};

const getAggregationsResolver = ({
	type,
	getServerSideFilter,
}: {
	type: Record<string, any>;
	getServerSideFilter: GetServerSideFilterFn | undefined;
}) => {
	const resolver: Resolver<unknown, AggregationsQueryVariables, Promise<Aggregations>> = async (
		obj,
		{ filters, aggregations_filter_themselves, include_missing = true },
		context,
		info,
	) => {
		const nestedFieldNames = type.nested_fieldNames;

		const { esClient } = context;

		// due to this problem in Elasticsearch 6.2 https://github.com/elastic/elasticsearch/issues/27782,
		// we have to resolve set ids into actual ids. As this is an aggregations specific issue,
		// we are placing this here until the issue is resolved by Elasticsearch in version 6.3
		const resolvedFilter = await resolveSetsInSqon({ sqon: filters, esClient });

		const query = buildQuery({
			nestedFieldNames,
			filters: compileFilter({
				clientSideFilter: resolvedFilter,
				serverSideFilter: getServerSideFilter && getServerSideFilter(),
			}),
		});

		/**
		 * TODO: getFields does not support aliased fields, so we are unable to
		 * serve multiple aggregations of the same type for a given field.
		 * Library issue: https://github.com/robrichard/graphql-fields/issues/18
		 */
		const graphqlFields = getFields(info, {}, { processArguments: true });
		const aggs = buildAggregations({
			query,
			sqon: resolvedFilter,
			graphqlFields,
			nestedFieldNames,
			aggregationsFilterThemselves: aggregations_filter_themselves,
		});

		const body = Object.keys(query || {}).length ? { query, aggs } : { aggs };
		const response = await esSearch(esClient)({
			index: type.index,
			size: 0,
			// @ts-expect-error - valid search query parameter in ES 7.17, not in types
			_source: false,
			body,
		});
		const aggregations = flattenAggregations({
			aggregations: response.aggregations,
			includeMissing: include_missing,
		});

		return aggregations;
	};

	return resolver;
};

export default getAggregationsResolver;
