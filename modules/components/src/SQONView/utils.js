/* @flow */
/* eslint fp/no-mutating-methods: 0 */

// $FlowIgnore
import _ from 'lodash';
import { parseSQONParam } from '../utils/uri';

import type {
  TValueContent,
  TValueSQON,
  TGroupContent,
  TGroupSQON,
  TMergeSQON,
  TCombineValues,
  TMergeFns,
  TMergeQuery,
  TSortSQON,
  TFilterByWhitelist,
  TRemoveSQON,
} from './types';

function compareTerms(a, b) {
  return (
    a.content.field === b.content.field &&
    a.op.toLowerCase() === b.op.toLowerCase()
  );
}

const sortSQON: TSortSQON = (a, b) => {
  if (a.content.field && b.content.field) {
    return a.content.field.localeCompare(b.content.field);
  } else if (a.content.field || b.content.field) {
    return a.content.field ? -1 : 1;
  } else {
    return 0;
  }
};

export const combineValues: TCombineValues = (x, y) => {
  const xValue = [].concat(x.content.value || []);
  const yValue = [].concat(y.content.value || []);

  if (xValue.length === 0 && yValue.length === 0) return null;
  if (xValue.length === 0) return y;
  if (yValue.length === 0) return x;

  const merged = {
    op: 'in',
    content: {
      field: x.content.field,
      value: xValue
        .reduce((acc, v) => {
          if (acc.includes(v)) return acc.filter(f => f !== v);
          return [...acc, v];
        }, yValue)
        .sort(),
    },
  };

  return merged.content.value.length ? merged : null;
};

export const addInValue: TCombineValues = (x, y) => {
  const xValue = [].concat(x.content.value || []);
  const yValue = [].concat(y.content.value || []);

  if (xValue.length === 0 && yValue.length === 0) return null;
  if (xValue.length === 0) return y;
  if (yValue.length === 0) return x;

  const merged = {
    op: 'in',
    content: {
      field: x.content.field,
      value: xValue
        .reduce((acc, v) => {
          if (acc.includes(v)) return acc;
          return [...acc, v];
        }, yValue)
        .sort(),
    },
  };

  return merged.content.value.length ? merged : null;
};

export const toggleSQON: TMergeSQON = (q, ctxq) => {
  if (!ctxq && !q) return null;
  if (!ctxq) return q;
  if (!q) return ctxq;

  const merged = {
    op: 'and',
    content: ctxq.content
      .reduce((acc, ctx) => {
        const found = acc.find(a => compareTerms(a, ctx));
        if (!found) return [...acc, ctx];
        return [
          ...acc.filter(y => y.content.field !== found.content.field),
          combineValues(found, ctx),
        ].filter(Boolean);
      }, q.content)
      .sort(sortSQON),
  };

  return merged.content.length ? merged : null;
};

export const replaceSQON: TMergeSQON = (q, ctxq) => {
  if (!ctxq && !q) return null;
  if (!ctxq) return q;
  if (!q) return ctxq;

  const merged = {
    op: 'and',
    content: ctxq.content
      .reduce((acc, ctx) => {
        const found = acc.find(a => compareTerms(a, ctx));
        if (!found) return [...acc, ctx];
        return acc;
      }, q.content)
      .sort(sortSQON),
  };

  return merged.content.length ? merged : null;
};

export const addInSQON: TMergeSQON = (q, ctxq) => {
  if (!ctxq && !q) return null;
  if (!ctxq) return q;
  if (!q) return ctxq;

  const merged = {
    op: 'and',
    content: ctxq.content
      .reduce((acc, ctx) => {
        const found = acc.find(a => compareTerms(a, ctx));
        if (!found) return [...acc, ctx];
        return [
          ...acc.filter(y => y.content.field !== found.content.field),
          addInValue(found, ctx),
        ].filter(Boolean);
      }, q.content)
      .sort(sortSQON),
  };

  return merged.content.length ? merged : null;
};

const mergeFns: TMergeFns = v => {
  switch (v) {
    case 'toggle':
      return toggleSQON;
    case 'add':
      return addInSQON;
    default:
      return replaceSQON;
  }
};

const filterByWhitelist: TFilterByWhitelist = (obj, wls) =>
  Object.keys(obj || {}).reduce(
    (acc, k) => (wls.includes(k) ? { ...acc, [k]: obj[k] } : acc),
    {},
  );

export const mergeQuery: TMergeQuery = (q, c, mergeType, whitelist) => {
  const ctx = c || {};
  const query = q || {};
  const wlCtx = whitelist ? filterByWhitelist(ctx, whitelist) : ctx;

  const mQs: Object = {
    ...wlCtx,
    ...query,
  };

  return {
    ...mQs,
    sqon: mergeFns(mergeType)(query.sqon, parseSQONParam(wlCtx.sqon, null)),
  };
};

export const setSQON = ({ value, field }: TValueContent) => ({
  op: 'and',
  content: [
    {
      op: 'in',
      content: { field, value },
    },
  ],
});

export const setSQONContent = (sqonContent: Array<TValueSQON>): ?TGroupSQON =>
  sqonContent.length
    ? {
        op: 'and',
        content: sqonContent,
      }
    : null;

// true if field and value in
export const inCurrentSQON = ({
  currentSQON, //TODO: this is actually sqon.content
  value,
  dotField,
}: {
  currentSQON: TGroupContent,
  value: string,
  dotField: string,
}): boolean => {
  return currentSQON.some(
    f =>
      f.content.field === dotField &&
      [].concat(f.content.value || []).includes(value),
  );
};

// true if field in
export const fieldInCurrentSQON = ({
  currentSQON,
  field,
}: {
  currentSQON: TGroupContent,
  field: string,
}) => currentSQON.some(f => f.content.field === field);

export const getSQONValue = ({
  currentSQON,
  dotField,
}: {
  currentSQON: TGroupContent,
  dotField: string,
}) => currentSQON.find(f => f.content.field === dotField);

type TMakeSQON = (
  fields: [{ field: string, value: string }],
) => Object | string;
export const makeSQON: TMakeSQON = fields => {
  if (!fields.length) return {};
  return {
    op: 'and',
    content: fields.map(item => {
      const value = _.isArray(item.value) ? item.value : item.value.split(',');

      return {
        op: 'in',
        content: {
          field: item.field,
          value,
        },
      };
    }),
  };
};

export const removeSQON: TRemoveSQON = (field, query) => {
  if (!query) return null;
  if (!field) return query;
  if (Object.keys(query).length === 0) return query;

  if (!Array.isArray(query.content)) {
    const fieldFilter = typeof field === 'function' ? field : f => f === field;
    return fieldFilter(query.content.field) ? null : query;
  }

  const filteredContent = query.content
    .map(q => removeSQON(field, q))
    .filter(Boolean);

  return filteredContent.length
    ? {
        ...query,
        content: filteredContent,
      }
    : null;
};

export default makeSQON;
