// sqon ops
export const IN_OP = 'in';
export const NOT_IN_OP = 'not-in';
export const ALL_OP = 'all';
export const SOME_NOT_IN_OP = 'some-not-in';
export const FILTER_OP = 'filter';
export const AND_OP = 'and';
export const OR_OP = 'or';
export const NOT_OP = 'not';
export const GT_OP = 'gt';
export const GTE_OP = 'gte';
export const LT_OP = 'lt';
export const LTE_OP = 'lte';
export const BETWEEN_OP = 'between';

// special values
export const REGEX = '*';
export const MISSING = '__missing__';
export const SET_ID = 'set_id:';

// sqon op aliases
export const OP_ALIASES = {
  '>': GT_OP,
  '<': LT_OP,
  '>=': GTE_OP,
  '<=': LTE_OP,
  '=': IN_OP,
  '!=': NOT_IN_OP,
};
export const DATE_FORMAT = 'YYYY-MM-DD';

export const ARRAY_CONTENT = [IN_OP, NOT_IN_OP, SOME_NOT_IN_OP, GT_OP, GTE_OP, LT_OP, LTE_OP];

// elasticsearch values
export const ES_WILDCARD = 'wildcard';
export const ES_MUST = 'must';
export const ES_MUST_NOT = 'must_not';
export const ES_SHOULD = 'should';
export const ES_NESTED = 'nested';
export const ES_PREFIX = 'prefix';
export const ES_BOOL = 'bool';
export const ES_QUERY = 'query';
export const ES_PATH = 'path';
export const ES_MULTI_MATCH = 'multi_match';
export const ES_FIELDS = 'fields';
export const ES_TYPE = 'type';
export const ES_PHRASE_PREFIX = 'phrase_prefix';
export const ES_DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss.SSSSSS';
export const ES_MAX_LONG = `-9223372036854775808`;
export const ES_ARRANGER_SET_INDEX = 'arranger-sets';
export const ES_ARRANGER_SET_TYPE = 'arranger-sets';

export const BUCKETS = 'buckets';
export const STATS = 'stats';
export const HISTOGRAM = 'histogram';
export const AGGS_WRAPPER_GLOBAL = 'global';
export const AGGS_WRAPPER_FILTERED = 'filtered';
export const AGGS_WRAPPER_NESTED = 'nested';
export const BUCKET_COUNT = 'bucket_count';
