// due to this problem in Elasticsearch 6.2 https://github.com/elastic/elasticsearch/issues/27782,
// we have to resolve set ids into actual ids. Once the issue is resolved
// by Elasticsearch in version 6.3, we no longer need these functions here.

import { flattenDeep, isArray, zipObject } from 'lodash';
import { CONSTANTS } from '@arranger/middleware';
import esSearch from './utils/esSearch';

const resolveSetIdsFromEs = (es) => (setId) =>
  esSearch(es)({
    index: CONSTANTS.ES_ARRANGER_SET_INDEX,
    body: {
      query: {
        bool: {
          must: { match: { setId } },
        },
      },
    },
  }).then(({ hits: { hits } }) => flattenDeep(hits.map(({ _source: { ids } }) => ids)));

const getSetIdsFromSqon = ({ content } = {}, collection = []) =>
  (isArray(content)
    ? flattenDeep(
        content.reduce(
          (acc, subSqon) => [...acc, ...getSetIdsFromSqon(subSqon, collection)],
          collection,
        ),
      )
    : isArray(content?.value)
    ? content?.value.filter((value) => String(value).indexOf('set_id:') === 0)
    : [...(String(content?.value).indexOf?.('set_id:') === 0 ? [content.value] : [])]
  ).map((setId) => setId.replace('set_id:', ''));

const injectIdsIntoSqon = ({ sqon, setIdsToValueMap }) => ({
  ...sqon,
  content: sqon.content.map((op) => ({
    ...op,
    content: !isArray(op.content)
      ? {
          ...op.content,
          value: isArray(op.content.value)
            ? flattenDeep(
                op.content.value.map((value) => setIdsToValueMap[value] || op.content.value),
              )
            : setIdsToValueMap[op.content.value] || op.content.value,
        }
      : injectIdsIntoSqon({ sqon: op, setIdsToValueMap }).content,
  })),
});

export const resolveSetsInSqon = ({ sqon, es }) => {
  const setIds = getSetIdsFromSqon(sqon || {});
  return setIds.length
    ? Promise.all(setIds.map(resolveSetIdsFromEs(es))).then((searchResult) => {
        const setIdsToValueMap = zipObject(
          setIds.map((id) => `set_id:${id}`),
          searchResult,
        );
        return injectIdsIntoSqon({ sqon, setIdsToValueMap });
      })
    : sqon;
};
