import getFields from 'graphql-fields';
import { flattenDeep, isArray } from 'lodash';

import {
  buildQuery,
  buildAggregations,
  flattenAggregations,
} from '@arranger/middleware';

let toGraphqlField = (acc, [a, b]) => ({ ...acc, [a.replace(/\./g, '__')]: b });

const getSetIdsFromSqon = ({ content }) =>
  (isArray(content)
    ? flattenDeep(content.map(getSetIdsFromSqon))
    : isArray(content.value)
      ? content.value.filter(value => value.indexOf('set_id:') === 0)
      : [...(content.value.indexOf?.('set_id:') === 0 ? [content.value] : [])]
  ).map(setId => setId.replace('set_id:', ''));

const resolveSetIdsFromEs = es => setId =>
  es
    .search({
      index: 'arranger-sets',
      type: 'arranger-sets',
      body: {
        query: {
          bool: {
            must: { match: { setId } },
          },
        },
      },
    })
    .then(({ hits: { hits } }) =>
      flattenDeep(hits.map(({ _source: { ids } }) => ids)),
    );

const injectIdsIntoSqon = ({ sqon, setIdsToValueMap }) => ({
  ...sqon,
  content: sqon.content.map(op => ({
    ...op,
    content: !isArray(op.content)
      ? {
          ...op.content,
          value: isArray(op.content.value)
            ? flattenDeep(
                op.content.value.map(
                  value => setIdsToValueMap[value] || op.content.value,
                ),
              )
            : setIdsToValueMap[op.content.value] || op.content.value,
        }
      : injectIdsIntoSqon({ sqon: op, setIdsToValueMap }).content,
  })),
});

const resolveSetsInSqon = ({ sqon, es }) => {
  const setIds = getSetIdsFromSqon(sqon || {});
  return setIds.length
    ? Promise.all(setIds.map(resolveSetIdsFromEs(es))).then(searchResult => {
        const setIdsToValueMap = setIds.reduce(
          (collection, id, i) => ({
            ...collection,
            [`set_id:${id}`]: searchResult[i],
          }),
          {},
        );
        return injectIdsIntoSqon({ sqon, setIdsToValueMap });
      })
    : sqon;
};

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
