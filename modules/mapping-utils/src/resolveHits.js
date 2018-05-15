import getFields from 'graphql-fields';
import { buildQuery } from '@arranger/middleware';

let joinParent = (parent, field) => (parent ? `${parent}.${field}` : field);

let resolveNested = ({ node, nestedFields, parent = '' }) => {
  if (typeof node !== 'object' || !node) return node;

  return Object.entries(node).reduce((acc, [field, hits]) => {
    // TODO: inner hits query if necessary
    const fullPath = joinParent(parent, field);

    return {
      ...acc,
      [field]: nestedFields.includes(fullPath)
        ? {
            hits: {
              edges: hits.map(node => ({
                node: {
                  ...node,
                  ...resolveNested({ node, nestedFields, parent: fullPath }),
                },
              })),
              total: hits.length,
            },
          }
        : typeof hits === 'object' && hits
          ? Object.assign(
              hits.constructor(),
              resolveNested({ node: hits, nestedFields, parent: fullPath }),
            )
          : resolveNested({ node: hits, nestedFields, parent: fullPath }),
    };
  }, {});
};

export default type => async (
  obj,
  { first = 10, offset = 0, filters, score, sort, searchAfter },
  { es },
  info,
) => {
  let fields = getFields(info);
  let nestedFields = type.nested_fields;

  let query = filters;

  if (filters || score) {
    // TODO: something with score?
    query = buildQuery({ nestedFields, filters });
  }

  let body =
    (query && {
      query,
    }) ||
    {};

  if (sort && sort.length) {
    // TODO: add query here to sort based on result. https://www.elastic.co/guide/en/elasticsearch/guide/current/nested-sorting.html
    body.sort = sort.map(({ field, missing, order, ...rest }) => {
      const nested_path = nestedFields
        .filter(nestedField => field.indexOf(nestedField) === 0)
        .reduce(
          (deepestPath, path) =>
            deepestPath.length > path.length ? deepestPath : path,
          null,
        );

      return {
        [field]: {
          missing: missing
            ? missing === 'first' ? '_first' : '_last'
            : order === 'asc' ? '_first' : '_last',
          order,
          ...rest,
          ...(nested_path ? { nested: { path: nested_path } } : {}),
        },
      };
    });
  }

  if (searchAfter) {
    body.search_after = searchAfter;
  }

  let { hits } = await es.search({
    index: type.index,
    type: type.es_type,
    size: first,
    from: offset,
    _source: fields.edges && Object.keys(fields.edges.node),
    track_scores: !!score,
    body,
  });

  let edges = hits.hits.map(x => {
    let source = x._source;
    let nested_nodes = resolveNested({ node: source, nestedFields });
    return {
      searchAfter: x.sort || [],
      node: { id: x._id, ...source, ...nested_nodes },
    };
  });

  return {
    edges,
    total: hits.total,
  };
};
