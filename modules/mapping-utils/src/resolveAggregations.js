import getFields from 'graphql-fields';

import {
  buildQuery,
  buildAggregations,
  flattenAggregations,
} from '@arranger/middleware';
import { resolveSetsInSqon } from './hackyTemporaryEsSetResolution';

let toGraphqlField = (acc, [a, b]) => ({ ...acc, [a.replace(/\./g, '__')]: b });

export default type => async (
  obj,
  {
    offset = 0,
    filters,
    aggregations_filter_themselves,
    include_missing = true,
  },
  { es },
  info,
) => {
  const nestedFields = type.nested_fields;

  // due to this problem in Elasticsearch 6.2 https://github.com/elastic/elasticsearch/issues/27782,
  // we have to resolve set ids into actual ids. As this is an aggregations specific issue,
  // we are placing this here until the issue is resolved by Elasticsearch in version 6.3
  const resolvedFilter = await resolveSetsInSqon({ sqon: filters, es });

  const query = buildQuery({ nestedFields, filters: resolvedFilter });
  const aggs = buildAggregations({
    query,
    sqon: resolvedFilter,
    graphqlFields: getFields(info),
    nestedFields,
    aggregationsFilterThemselves: aggregations_filter_themselves,
  });

  console.log('aggs: ', JSON.stringify(aggs));
  console.log('---------');
  console.log('query: ', JSON.stringify(query));

  const body = Object.keys(query || {}).length ? { query, aggs } : { aggs };
  const response = await es.search({
    index: type.index,
    type: type.es_type,
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
