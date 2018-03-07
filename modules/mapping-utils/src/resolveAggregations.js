import getFields from 'graphql-fields';
import buildAggregations from './buildAggregations';
import pruneAggregations from './pruneAggregations';

let toGraphqlField = (acc, [a, b]) => ({ ...acc, [a.replace(/\./g, '__')]: b });

export default type => async (obj, { offset = 0, ...args }, { es }, info) => {
  let graphql_fields = getFields(info);
  let fields = Object.keys(graphql_fields);
  let nested_fields = type.nested_fields;
  const { extendedFields } = type;

  let { query, aggs } = buildAggregations({
    type,
    args,
    fields,
    graphql_fields,
    nested_fields,
  });

  let body =
    query && Object.keys(query).length
      ? {
          query,
          aggs,
        }
      : { aggs };

  let { aggregations } = await es.search({
    index: type.index,
    type: type.es_type,
    size: 0,
    _source: false,
    body,
  });

  let { pruned } = await pruneAggregations({
    aggs: aggregations,
    nested_fields,
  });

  return Object.entries(pruned).reduce(toGraphqlField, {});
};
