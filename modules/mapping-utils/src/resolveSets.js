import { get, isEmpty, uniq } from 'lodash';
import uuid from 'uuid/v4';
import { buildQuery } from '@arranger/middleware';

const mapIds = ({ response, path }) =>
  response.hits.hits.map(x => get(x, `_source.${path.split('__').join('.')}`));

const retrieveSetIds = async ({
  es,
  index,
  type,
  query,
  path,
  SCROLL_TIME = '1m',
  BULK_SIZE = 1000,
}) => {
  const handleResult = async ({ scrollId, total, ids = [] }) => {
    if (ids.length === total) return uniq(ids);
    const response = await es.scroll({ scroll: SCROLL_TIME, scrollId });
    return handleResult({
      total,
      scrollId: response._scroll_id,
      ids: [...ids, ...mapIds({ response, path })],
    });
  };
  const response = await es.search({
    index,
    type,
    sort: ['_id'],
    scroll: SCROLL_TIME,
    size: BULK_SIZE,
    body: { ...(!isEmpty(query) && { query }) },
  });
  return handleResult({
    scrollId: response._scroll_id,
    ids: mapIds({ response, path }),
    total: response.hits.total,
  });
};

export const saveSet = ({ types }) => async (
  obj,
  { index, userId, sqon, path },
  { es, projectId, io },
) => {
  const { nested_fields: nestedFields, es_type } = types.find(
    ([, type]) => type.index === index,
  )[1];
  const query = buildQuery({ nestedFields, filters: sqon || {} });
  const ids = await retrieveSetIds({
    es,
    index,
    type: es_type,
    query,
    path,
  });

  const body = {
    setId: uuid(),
    createdAt: Date.now(),
    ids,
    path,
    sqon,
    userId,
    size: ids.length,
    type: index,
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
