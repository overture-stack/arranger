import getFields from 'graphql-fields';

import { buildAggregations, buildQuery, flattenAggregations } from '../middleware';

import { resolveSetsInSqon } from './hackyTemporaryEsSetResolution';
import compileFilter from './utils/compileFilter';
import esSearch from './utils/esSearch';

export default ({ type, getServerSideFilter }) => {
	return async (
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
				serverSideFilter: getServerSideFilter(context),
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
			_source: false,
			body,
		});
		const aggregations = flattenAggregations({
			aggregations: response.aggregations,
			includeMissing: include_missing,
		});

		return aggregations;
	};
};

const toGraphqlField = (acc, [a, b]) => ({ ...acc, [a.replace(/\./g, '__')]: b });
export const aggregationsToGraphql = (aggregations) => {
	return Object.entries(aggregations).reduce(toGraphqlField, {});
};
