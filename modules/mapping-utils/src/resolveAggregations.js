import getFields from 'graphql-fields';

import { buildQuery, buildAggregations, flattenAggregations } from '@arranger/middleware';
import { resolveSetsInSqon } from './hackyTemporaryEsSetResolution';
import esSearch from './utils/esSearch';
import compileFilter from './utils/compileFilter';

let toGraphqlField = (acc, [a, b]) => ({ ...acc, [a.replace(/\./g, '__')]: b });

export default ({ type, getServerSideFilter }) => async (
  obj,
  { offset = 0, filters, aggregations_filter_themselves, include_missing = true },
  { es },
  info,
) => {
  const nestedFields = type.nested_fields;

  // due to this problem in Elasticsearch 6.2 https://github.com/elastic/elasticsearch/issues/27782,
  // we have to resolve set ids into actual ids. As this is an aggregations specific issue,
  // we are placing this here until the issue is resolved by Elasticsearch in version 6.3
  const resolvedFilter = await resolveSetsInSqon({ sqon: filters, es });

  const query = buildQuery({
    nestedFields,
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
    nestedFields,
    aggregationsFilterThemselves: aggregations_filter_themselves,
  });

  const body = Object.keys(query || {}).length ? { query, aggs } : { aggs };
  const response = await esSearch(es)({
    index: type.index,
    size: 0,
    _source: false,
    body,
  });
  const aggregations = flattenAggregations({
    aggregations: response.aggregations,
    includeMissing: include_missing,
  });

  return Object.entries(aggregations).reduce(toGraphqlField, {});
};
