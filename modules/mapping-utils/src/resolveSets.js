import { get, isEmpty, uniq } from 'lodash';
import uuid from 'uuid/v4';
import { CONSTANTS, buildQuery } from '@arranger/middleware';
import esSearch from './utils/esSearch';
import compileFilter from './utils/compileFilter';
import {
  addSqonToSetSqon,
  makeUnique,
  removeSqonToSetSqon,
  retrieveIdsFromQuery,
  truncateIds,
} from './utils/sets';
import mapHits from './utils/mapHits';

const isQueryEmpty = (sqon) => !sqon || sqon.content.length === 0;

const ActionTypes = {
  RENAME_TAG: 'RENAME_TAG',
  ADD_IDS: 'ADD_IDS',
  REMOVE_IDS: 'REMOVE_IDS',
};

const renameTag = async ({ es, setId, newTag, subAction, userId }) => {
  const esResponse = await es.updateByQuery({
    index: CONSTANTS.ES_ARRANGER_SET_INDEX,
    refresh: true,
    body: {
      script: {
        lang: 'painless',
        source: `ctx._source.tag = params.newTag`,
        params: {
          newTag,
        },
      },
      query: {
        bool: {
          filter: {
            term: { userId: userId },
          },
          must: {
            term: {
              setId: {
                value: setId,
              },
            },
          },
        },
      },
    },
  });

  return {
    updatedResults: esResponse.updated,
  };
};

const addOrRemoveIds = async ({ types, es, userId, setId, sqon, subAction, type, path }) => {
  const esSearchResponse = await esSearch(es)({
    index: CONSTANTS.ES_ARRANGER_SET_INDEX,
    body: {
      query: {
        bool: {
          filter: {
            term: { userId: userId },
          },
          must: {
            term: {
              setId: {
                value: setId,
              },
            },
          },
        },
      },
    },
  });

  const { nested_fields: nestedFields, index } = types.find(([, x]) => x.name === type)[1];

  const query = buildQuery({ nestedFields, filters: sqon || {} });

  const idsFromQuery = await retrieveIdsFromQuery({
    es,
    index: index,
    query,
    path,
    sort: [{ field: '_id', order: 'asc' }],
  });

  if (idsFromQuery.length === 0) {
    return {
      updatedResults: 0,
    };
  }

  const sets = mapHits(esSearchResponse);
  const setToUpdate = sets[0];
  const { ids = [], sqon: sqonFromExistingSet } = setToUpdate;

  let updatedIds = [];
  let combinedSqon;
  if (ActionTypes.ADD_IDS === subAction) {
    const concatenatedIds = [...ids, ...idsFromQuery];
    updatedIds = truncateIds(makeUnique(concatenatedIds));
    combinedSqon = addSqonToSetSqon(sqonFromExistingSet, sqon);
  } else if (ActionTypes.REMOVE_IDS === subAction) {
    updatedIds = ids.filter((id) => !idsFromQuery.includes(id));
    combinedSqon = removeSqonToSetSqon(sqonFromExistingSet, sqon);
  }

  const idsSize = updatedIds.length;

  const esUpdateResponse = await es.updateByQuery({
    index: CONSTANTS.ES_ARRANGER_SET_INDEX,
    refresh: true,
    body: {
      script: {
        lang: 'painless',
        source: `ctx._source.ids = params.updatedIds ; ctx._source.size = params.newSize; ctx._source.sqon = params.combinedSqon`,
        params: {
          updatedIds: updatedIds,
          newSize: idsSize,
          combinedSqon,
        },
      },
      query: {
        bool: {
          filter: {
            term: { userId: userId },
          },
          must: {
            term: {
              setId: {
                value: setId,
              },
            },
          },
        },
      },
    },
  });

  return {
    setSize: idsSize,
    updatedResults: esUpdateResponse.body.updated,
  };
};

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
  { type, userId, sqon, path, sort, refresh = 'WAIT_FOR', tag },
  context,
) => {
  const { nested_fields: nestedFields, index } = types.find(([, x]) => x.name === type)[1];
  const { es, projectId } = context;

  const query = buildQuery({
    nestedFields,
    filters: compileFilter({
      clientSideFilter: sqon,
      serverSideFilter: getServerSideFilter(context),
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
    tag,
  };

  await es.index({
    index: CONSTANTS.ES_ARRANGER_SET_INDEX,
    id: body.setId,
    refresh: refresh.toLowerCase(),
    body,
  });

  return body;
};

export const updateSet = ({ types }) => async (
  obj,
  { subAction, target, userId, data },
  { es },
) => {
  switch (subAction) {
    case ActionTypes.REMOVE_IDS:
    case ActionTypes.ADD_IDS: {
      const { type, sqon, path } = data;

      if (isQueryEmpty(sqon)) {
        return {
          updatedResults: 0,
        };
      }

      const { setId } = target;

      return await addOrRemoveIds({
        es,
        types,
        userId,
        setId,
        sqon,
        subAction,
        type,
        path,
      });
    }

    case ActionTypes.RENAME_TAG: {
      const { setId } = target;
      const { newTag } = data;
      return await renameTag({
        es,
        subAction,
        userId,
        setId,
        newTag,
      });
    }
    default:
      return {
        updatedResults: 0,
      };
  }
};

export const deleteSets = () => async (obj, { setIds, userId }, { es }) => {
  const esResponse = await es.deleteByQuery({
    index: CONSTANTS.ES_ARRANGER_SET_INDEX,
    body: {
      query: {
        bool: {
          filter: {
            term: { userId: userId },
          },
          must: {
            terms: {
              setId: setIds,
            },
          },
        },
      },
    },
  });

  return esResponse.body?.deleted || 0;
};
