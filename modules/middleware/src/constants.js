export const EQ = '=';
export const NEQ = '!=';
export const IN = 'in';
export const EXCLUDE = 'exclude';
export const EXCLUDE_IF_ANY = 'excludeifany';
export const FILTER = 'filter';
export const GT = '>';
export const GTE = '>=';
export const LT = '<';
export const LTE = '<=';
export const AND = 'and';
export const OR = 'or';
export const IS = 'is';
export const NOT = 'not';
export const RANGE_OPS = [GT, LT, GTE, LTE];
export const HAVE_OPS = [EQ, IN];
export const HAVE_NOT_OPS = [NEQ, EXCLUDE];
export const IS_OPS = [IS, NOT];
export const GROUP_OPS = [AND, OR];
export const BUCKETS = 'buckets';
export const STATS = 'stats';
export const HISTOGRAM = 'histogram';
export const VALUE_OPS = HAVE_OPS.concat(HAVE_NOT_OPS).concat([EXCLUDE_IF_ANY]);
export const MUST_OPS = HAVE_OPS.concat(IS_OPS).concat([FILTER]);
export const MUST_NOT_OPS = HAVE_NOT_OPS.concat([EXCLUDE_IF_ANY]);
export const ES_RANGE_OPS = {
  [GT]: 'gt',
  [LT]: 'lt',
  [GTE]: 'gte',
  [LTE]: 'lte',
};
export const AGGS_WRAPPER_TYPES = {
  GLOBAL: 'global',
  FILTERED: 'filtered',
  NESTED: 'nested',
};
export const ES_MUST = 'must';
export const ES_MUST_NOT = 'must_not';
export const ES_SHOULD = 'should';
export const ES_NESTED = 'nested';
export const ES_BOOL = 'bool';
export const ES_FILTER = 'filter';
export const ES_QUERY = 'query';
export const ES_PATH = 'path';
export const ES_MULTI_MATCH = 'multi_match';
export const ES_FIELDS = 'fields';
export const ES_TYPE = 'type';
export const ES_PHRASE_PREFIX = 'phrase_prefix';
export const FIELD_TO_SET_TYPE = {};
