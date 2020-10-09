import { get, isEmpty, uniq } from 'lodash';
import uuid from 'uuid/v4';
import { CONSTANTS, buildQuery } from '@arranger/middleware';
import esSearch from './utils/esSearch';
import compileFilter from './utils/compileFilter';

const retrieveSetIds = async ({ es, index, query, path, sort, BULK_SIZE = 1000 }) => {
  const search = async ({ searchAfter } = {}) => {
    const body = {
      ...(!isEmpty(query) && { query }),
      ...(searchAfter && { search_after: searchAfter }),
    };

    const response = await esSearch(es)({
      index,
      sort: sort.map(({ field, order }) => `${field}:${order || 'asc'}`),
      size: BULK_SIZE,
      body,
    });
    const ids = response.hits.hits.map((x) =>
      get(x, `_source.${path.split('__').join('.')}`, x._id || ''),
    );

    const nextSearchAfter = sort
      .map(({ field }) => response.hits.hits.map((x) => x._source[field] || x[field]))
      .reduce((acc, vals) => [...acc, ...vals.slice(-1)], []);

    return {
      ids,
      searchAfter: nextSearchAfter,
      total: response.hits.total.value,
    };
  };
  const handleResult = async ({ searchAfter, total, ids = [] }) => {
    if (ids.length === total) return uniq(ids);
    const { ids: newIds, ...response } = await search({ searchAfter });
    return handleResult({ ...response, ids: [...ids, ...newIds] });
  };
  return handleResult(await search());
};

export const saveSet = ({ types, getServerSideFilter }) => async (
  obj,
  { type, userId, sqon, path, sort, refresh = 'WAIT_FOR' },
  { es, projectId },
) => {
  const { nested_fields: nestedFields, index } = types.find(([, x]) => x.name === type)[1];

  const query = buildQuery({
    nestedFields,
    filters: compileFilter({
      clientSideFilter: sqon,
      serverSideFilter: getServerSideFilter(),
    }),
  });
  const ids = await retrieveSetIds({
    es,
    index,
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
    id: body.setId,
    refresh: refresh.toLowerCase(),
    body,
  });

  return body;
};
