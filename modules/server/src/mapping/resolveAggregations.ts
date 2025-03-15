import getFields from 'graphql-fields';

import { buildAggregations, buildQuery, flattenAggregations } from '../middleware';

import { Resolver } from '@/gqlServer';
import { GetServerSideFilterFn } from '@/utils/getDefaultServerSideFilter';
import { resolveSetsInSqon } from './hackyTemporaryEsSetResolution';
import { Relation } from './masking';
import { AggregationQuery, Root } from './types';
import compileFilter from './utils/compileFilter';
import esSearch from './utils/esSearch';

const toGraphqlField = (acc: Aggregations, [a, b]: [string, Aggregation]) => ({
	...acc,
	[a.replace(/\./g, '__')]: b,
});
export const aggregationsToGraphql = (aggregations: Aggregations) => {
	return Object.entries(aggregations).reduce<Aggregations>(toGraphqlField, {});
};

/*
 * Types
 */
export type Bucket = {
	doc_count: number;
	key: string;
	relation: Relation;
};

export type Aggregation = {
	bucket_count: number;
	buckets: Bucket[];
};

export type Aggregations = Record<string, Aggregation>;

export type AggregationsResolver = Resolver<Root, AggregationQuery, Promise<Aggregations>>;

const getAggregationsResolver = ({
	type,
	getServerSideFilter,
}: {
	type: Record<string, any>;
	getServerSideFilter: GetServerSideFilterFn | undefined;
}) => {
	const resolver: Resolver<unknown, AggregationQuery, Promise<Aggregations>> = async (
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
