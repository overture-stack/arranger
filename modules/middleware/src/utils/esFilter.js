import _ from 'lodash';
import * as CONSTANTS from '../constants';

export function isNested(filter) {
  return filter && filter.hasOwnProperty(CONSTANTS.ES_NESTED);
}

export function readPath(filter) {
  return _.get(filter, [CONSTANTS.ES_NESTED, CONSTANTS.ES_PATH], '');
}

export function readNestedBool(filter) {
  return _.get(
    filter,
    [CONSTANTS.ES_NESTED, CONSTANTS.ES_QUERY, CONSTANTS.ES_BOOL],
    {},
  );
}

export function wrapNot(value) {
  return wrapBool(CONSTANTS.ES_MUST_NOT, value);
}

export function wrapMust(value) {
  return wrapBool(CONSTANTS.ES_MUST, value);
}

export function wrapFilter(esFilter, path) {
  return {
    [CONSTANTS.ES_NESTED]: {
      [CONSTANTS.ES_PATH]: path,
      [CONSTANTS.ES_QUERY]: esFilter,
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
