import getFields from 'graphql-fields';
import {
  buildQuery,
  buildAggregations,
  flattenAggregations,
} from '@arranger/middleware';

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
  const query = buildQuery({ nestedFields, filters });
  const aggs = buildAggregations({
    query,
    graphqlFields: getFields(info),
    nestedFields,
    aggregationsFilterThemselves: aggregations_filter_themselves,
  });

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
