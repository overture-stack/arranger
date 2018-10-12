import { get, isEmpty, uniq } from 'lodash';
import uuid from 'uuid/v4';
import { CONSTANTS, buildQuery } from '@arranger/middleware';

const retrieveSetIds = async ({
  es,
  index,
  type,
  query,
  path,
  sort,
  BULK_SIZE = 1000,
}) => {
  const search = async ({ searchAfter } = {}) => {
    const body = {
      ...(!isEmpty(query) && { query }),
      ...(searchAfter && { search_after: searchAfter }),
    };

    const response = await es.search({
      index,
      type,
      sort: sort.map(({ field, order }) => `${field}:${order || 'asc'}`),
      size: BULK_SIZE,
      body,
    });
    const ids = response.hits.hits.map(x =>
      get(x, `_source.${path.split('__').join('.')}`, x._id || ''),
    );

    const nextSearchAfter = sort
      .map(({ field }) =>
        response.hits.hits.map(x => x._source[field] || x[field]),
      )
      .reduce((acc, vals) => [...acc, ...vals.slice(-1)], []);

    return {
      ids,
      searchAfter: nextSearchAfter,
      total: response.hits.total,
    };
  };
  const handleResult = async ({ searchAfter, total, ids = [] }) => {
    if (ids.length === total) return uniq(ids);
    const { ids: newIds, ...response } = await search({ searchAfter });
    return handleResult({ ...response, ids: [...ids, ...newIds] });
  };
  return handleResult(await search());
};

export const saveSet = ({ types }) => async (
  obj,
  { type, userId, sqon, path, sort, refresh = 'WAIT_FOR' },
  { es, projectId },
) => {
  const { nested_fields: nestedFields, es_type, index } = types.find(
    ([, x]) => x.name === type,
  )[1];
  const query = buildQuery({ nestedFields, filters: sqon || {} });
  const ids = await retrieveSetIds({
    es,
    index: index,
    type: es_type,
    query,
    path,
    sort: sort && sort.length ? sort : [{ field: '_id', order: 'asc' }],
  });

  const body = {
    setId: uuid(),
    createdAt: Date.now(),
    ids,
    type,
    path,
    sqon,
    userId,
    size: ids.length,
  };

  await es.index({
    index: CONSTANTS.ES_ARRANGER_SET_INDEX,
    type: CONSTANTS.ES_ARRANGER_SET_TYPE,
    id: body.setId,
    refresh: refresh.toLowerCase(),
    body,
  });

  return body;
};
