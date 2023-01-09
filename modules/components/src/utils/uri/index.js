/* @flow */

// import type { TParseSQONParam, TParseJSONParam, TParseIntParam } from './types';

// export const parseIntParam: TParseIntParam = (str, defaults) =>
export const parseIntParam = (str, defaults) => (str ? Math.max(parseInt(str, 10), 0) : defaults);

// export const parseJSONParam: TParseJSONParam = (str, defaults) => {
export const parseJSONParam = (str, defaults) => {
  if (str) {
    return JSON.parse(str) || defaults;
  } else {
    return defaults;
  }
};

// export const stringifyJSONParam: TParseJSONParam = (str, defaults) =>
export const stringifyJSONParam = (str, defaults) => (str ? JSON.stringify(str) : defaults);

// export const parseSQONParam: TParseSQONParam = parseJSONParam;
export const parseSQONParam = parseJSONParam;
