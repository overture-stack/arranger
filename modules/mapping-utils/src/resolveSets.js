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
}) =>
  new Promise((resolve, reject) => {
    const handleResult = ({ ids = [] }) => (err, response) => {
      err && reject(err);
      const newIds = [...ids, ...mapIds({ response, path })];
      response.hits.total === newIds.length
        ? resolve(uniq(newIds))
        : es.scroll(
            { scroll: SCROLL_TIME, scrollId: response._scroll_id },
            handleResult({ ids: newIds }),
          );
    };
    es.search(
      {
        index,
        type,
        sort: ['_id'],
        scroll: SCROLL_TIME,
        size: BULK_SIZE,
        body: { ...(!isEmpty(query) && { query }) },
      },
      handleResult({}),
    );
  });

export const saveSet = ({ types }) => async (
  obj,
  { index, userId, sqon, path },
  { es, projectId, io },
) => {
  const finalSqon = sqon || {};
  const { nested_fields: nestedFields, es_type } = types.find(
    ([, type]) => type.index === index,
  )[1];
  const query = buildQuery({ nestedFields, filters: finalSqon });
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
    size: ids.length,
    sqon: finalSqon,
    type: index,
    userId,
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
