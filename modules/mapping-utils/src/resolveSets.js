import { get, isEmpty, uniq } from 'lodash';
import uuid from 'uuid/v4';
import { buildQuery } from '@arranger/middleware';

const retrieveSetIds = async ({
  es,
  index,
  type,
  query,
  path,
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
      sort: ['_id'],
      size: BULK_SIZE,
      body,
    });
    console.log(JSON.stringify(body, null, 2));
    console.log(JSON.stringify(response.hits.total, null, 2));
    const ids = response.hits.hits.map(x =>
      get(x, `_source.${path.split('__').join('.')}`),
    );
    return { ids, searchAfter: ids.slice(-1), total: response.hits.total };
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
  { type, userId, sqon, path },
  { es, projectId, io },
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
    index: 'arranger-sets',
    type: 'arranger-sets',
    id: body.setId,
    body,
  });

  return body;
};

const resolveSets = async () => {
  console.log('resolve Sets');
};

export default resolveSets;
