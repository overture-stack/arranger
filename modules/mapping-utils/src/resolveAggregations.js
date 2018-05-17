import getFields from 'graphql-fields';
import { flattenDeep } from 'lodash';

import {
  buildQuery,
  buildAggregations,
  flattenAggregations,
} from '@arranger/middleware';

let toGraphqlField = (acc, [a, b]) => ({ ...acc, [a.replace(/\./g, '__')]: b });

const getSetIdsFromSqon = ({ content }) => {
  return (content || [])
    .reduce((setIds, { content: subContent }) => {
      return [
        ...setIds,
        ...(subContent.value || []).filter(
          value => value.indexOf('set_id:') === 0,
        ),
      ];
    }, [])
    .map(setId => setId.replace('set_id:', ''));
};

const resolveValuesFromSetId = es => setId =>
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
    .then(({ hits: { hits } }) => hits.map(({ _source: { ids } }) => ids));

const resolveSetsInSqon = ({ sqon, es }) => {
  const setIds = getSetIdsFromSqon(sqon || {});
  if (setIds.length) {
    return Promise.all(setIds.map(resolveValuesFromSetId(es))).then(
      searchResult => {
        const setIdsToValueMap = setIds.reduce(
          (collection, id, i) => ({
            ...collection,
            [`set_id:${id}`]: flattenDeep(searchResult),
          }),
          {},
        );
        console.log('sqon: ');
        const output = {
          ...sqon,
          content: sqon.content.map(op => ({
            ...op,
            content: {
              ...op.content,
              value:
                flattenDeep(
                  op.content.value.map(value => setIdsToValueMap[value]),
                ) || op.content.value,
            },
          })),
        };
        return output;
      },
    );
  } else {
    return sqon;
  }
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

  const resolvedFilter = await resolveSetsInSqon({ sqon: filters, es });

  console.log('resolvedFilter: ', JSON.stringify(resolvedFilter));

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
