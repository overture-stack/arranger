import _ from 'lodash';
import * as CONSTANTS from '../constants';

export function mergePath(target, [key, ...path], data) {
  return {
    ...target,
    [key]: path.length ? mergePath(target[key], path, data) : data,
  };
}

export function isNested(filter) {
  return filter && filter.hasOwnProperty(CONSTANTS.ES_NESTED);
}

export function readPath(filter) {
  return _.get(filter, [CONSTANTS.ES_NESTED, CONSTANTS.ES_PATH], '');
}

export function wrapMustNot(value) {
  return wrapBool(CONSTANTS.ES_MUST_NOT, value);
}

export function wrapMust(value) {
  return wrapBool(CONSTANTS.ES_MUST, value);
}

export function wrapShould(value) {
  return wrapBool(CONSTANTS.ES_SHOULD, value);
}

export function wrapNested(esFilter, path) {
  return {
    [CONSTANTS.ES_NESTED]: {
      [CONSTANTS.ES_PATH]: path,
      [CONSTANTS.ES_QUERY]: esFilter[CONSTANTS.ES_BOOL]
        ? esFilter
        : wrapMust(esFilter),
    },
  };
}

export function wrapBool(op, value) {
  return {
    [CONSTANTS.ES_BOOL]: {
      [op]: Array.isArray(value) ? value : [value],
    },
  };
}
