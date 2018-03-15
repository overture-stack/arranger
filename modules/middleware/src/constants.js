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

export const AGGS_WRAPPER_TYPES = {
  GLOBAL: 'global',
  FILTERED: 'filtered',
  NESTED: 'nested',
};

export const CONSTANTS = {
  EQ: EQ,
  NEQ: NEQ,
  IN: IN,
  EXCLUDE: EXCLUDE,
  EXCLUDE_IF_ANY: EXCLUDE_IF_ANY,
  FILTER: FILTER,
  GT: GT,
  GTE: GTE,
  LT: LT,
  LTE: LTE,
  AND: AND,
  OR: OR,
  IS: IS,
  NOT: NOT,
  HAVE_OPS: HAVE_OPS,
  HAVE_NOT_OPS: HAVE_NOT_OPS,
  IS_OPS: IS_OPS,
  VALUE_OPS: HAVE_OPS.concat(HAVE_NOT_OPS).concat([EXCLUDE_IF_ANY]),
  MUST_OPS: HAVE_OPS.concat(IS_OPS).concat([FILTER]),
  MUST_NOT_OPS: HAVE_NOT_OPS.concat([EXCLUDE_IF_ANY]),
  GROUP_OPS: GROUP_OPS,
  RANGE_OPS: RANGE_OPS,
  ES_RANGE_OPS: { [GT]: 'gt', [LT]: 'lt', [GTE]: 'gte', [LTE]: 'lte' },
  ES_MUST: 'must',
  ES_MUST_NOT: 'must_not',
  ES_SHOULD: 'should',
  ES_NESTED: 'nested',
  ES_BOOL: 'bool',
  ES_FILTER: 'filter',
  ES_QUERY: 'query',
  ES_PATH: 'path',
  ES_MULTI_MATCH: 'multi_match',
  ES_FIELDS: 'fields',
  ES_TYPE: 'type',
  ES_PHRASE_PREFIX: 'phrase_prefix',
  FIELD_TO_SET_TYPE: {},
  BUCKETS: 'buckets',
  STATS: 'stats',
  HISTOGRAM: 'histogram',
};
