import { get, isEmpty } from 'lodash';
import esSearch from './esSearch';

export const addSqonToSetSqon = (receivingSqon, donorSqon, op = 'or') => {
  const receivingContent = receivingSqon?.content || [];
  const donorContent = donorSqon?.content || [];
  return {
    op,
    content: [...receivingContent, ...donorContent],
  };
};

export const removeSqonToSetSqon = (setSqon, sqonToRemove) => {
  const setSqonContent = setSqon?.content || [];
  const sqonToRemoveContent = sqonToRemove?.content || [];
  const negatedContent = sqonToRemoveContent.map((filter) => ({
    op: 'not-in',
    content: filter.content,
  }));
  return {
    op: 'and',
    content: [...setSqonContent, ...negatedContent],
  };
};

export const makeUnique = (ids) => [...new Set(ids)];

const MAX_NUMBER_OF_IDS = 20000;

export const truncateIds = (ids) => (ids || []).slice(0, MAX_NUMBER_OF_IDS);

export const retrieveIdsFromQuery = async ({ es, index, query, path, sort, BULK_SIZE = 1000 }) => {
  let i = 0;
  let total = 0;
  const acc = [];

  do {
    const body = {
      ...(!isEmpty(query) && { query }),
    };
    const response = await esSearch(es)({
      index,
      sort: sort.map(({ field, order }) => `${field}:${order || 'asc'}`),
      from: i * BULK_SIZE,
      size: BULK_SIZE,
      body,
    });

    const ids = response.body.hits.hits.map((x) =>
      get(x, `_source.${path.split('__').join('.')}`, x._id || ''),
    );

    total = response.hits.hits.length || 0;

    acc.push(...ids);

    i++;
  } while (i < MAX_NUMBER_OF_IDS / BULK_SIZE && total === BULK_SIZE);

  return acc;
};
