import getFields from 'graphql-fields';
import { buildAggregations, flattenAggregations } from '@arranger/middleware';
import { buildQuery } from '@arranger/middleware';

let toGraphqlField = (acc, [a, b]) => ({ ...acc, [a.replace(/\./g, '__')]: b });

export default type => async (
  obj,
  {
    offset = 0,
    filters,
    aggregations_filter_themselves: aggregationsFilterThemselves,
  },
  { es },
  info,
) => {
  const graphqlFields = getFields(info);
  const nestedFields = type.nested_fields;
  const query = buildQuery({ nestedFields, filters });
  const aggs = buildAggregations({
    query,
    graphqlFields,
    nestedFields,
    aggregationsFilterThemselves,
  });

  const body =
    query && Object.keys(query).length
      ? {
          query,
          aggs,
        }
      : { aggs };

  const response = await es.search({
    index: type.index,
    type: type.es_type,
    size: 0,
    _source: false,
    body,
  });

  const aggregations = flattenAggregations(response.aggregations);

  return Object.entries(aggregations).reduce(toGraphqlField, {});
};
