import { Resolver } from '@/gqlServer';
import { GetServerSideFilterFn } from '@/utils/getDefaultServerSideFilter';
import getFields from 'graphql-fields';

import { buildAggregations, buildQuery, flattenAggregations } from '../middleware';
import { resolveSetsInSqon } from './hackyTemporaryEsSetResolution';
import { Relation } from './masking';
import compileFilter from './utils/compileFilter';
import esSearch from './utils/esSearch';

/*
 * GQL query types
 */
export type GQLAggregationQueryFilters = {
	filters: any;
	aggregations_filter_themselves: boolean;
	include_missing: boolean;
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

/**
 * This could be singular or multiple
 * Project defines "Aggregations" as
 *
 * ```
 * const Aggregations = {
 *	  donor_age: {
 *		  bucket_count: 0,
 *		  buckets: []
 *	  }
 * }
 * ```
 * Our typing also works as a collection, which makes it hard to discern between singular and multiple.
 * Example of valid typed collection of "Aggregations"
 *
 * ```
 * const Aggregations = {
 *    donor_age: {
 *      bucket_count: 0,
 *		  buckets: [],
 *	  },
 *		donor_gender: {
 *		  bucket_count: 0,
 *		  buckets: [],
 *	  }
 * }
 * ```
 */
export type Aggregations = Record<string, Aggregation>;

const resolveAggregations = ({
	type,
	getServerSideFilter,
}: {
	type: { index: string; nested_fieldNames: string[] };
	getServerSideFilter: GetServerSideFilterFn;
}) => {
	const resolver: Resolver<unknown, GQLAggregationQueryFilters, Promise<Aggregations>> = async (
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
				serverSideFilter: getServerSideFilter(),
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

export default resolveAggregations;

const toGraphqlField = (acc: Aggregations, [a, b]: [string, Aggregation]) => ({
	...acc,
	[a.replace(/\./g, '__')]: b,
});
export const aggregationsToGraphql = (aggregations: Aggregations) => {
	return Object.entries(aggregations).reduce<Aggregations>(toGraphqlField, {});
};
