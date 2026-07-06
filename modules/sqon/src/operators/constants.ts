export const sqonCombinationProperties = {
	AND: 'and',
	OR: 'or',
	NOT: 'not',
} as const;

export const sqonFieldOperatorProperties = {
	ALL: 'all',
	BETWEEN: 'between',
	GT: 'gt',
	GTE: 'gte',
	IN: 'in',
	LT: 'lt',
	LTE: 'lte',
	NOT_IN: 'not-in',
	SOME_NOT_IN: 'some-not-in',
	WILDCARD: 'wildcard',
} as const;

export const sqonAliasProperties = {
	FILTER: 'filter',
	GT: '>',
	GTE: '>=',
	IN: '=',
	IN_DOUBLE: '==',
	IN_TRIPLE: '===',
	LT: '<',
	LTE: '<=',
	NOT_IN: '!=',
	NOT_IN_DOUBLE: '!==',
} as const;

export const SQON_COMBINATION_OPS = [
	sqonCombinationProperties.AND,
	sqonCombinationProperties.OR,
	sqonCombinationProperties.NOT,
] as const;

export const SQON_FIELD_OPS = [
	sqonFieldOperatorProperties.IN,
	sqonFieldOperatorProperties.NOT_IN,
	sqonFieldOperatorProperties.SOME_NOT_IN,
	sqonFieldOperatorProperties.ALL,
	sqonFieldOperatorProperties.GT,
	sqonFieldOperatorProperties.GTE,
	sqonFieldOperatorProperties.LT,
	sqonFieldOperatorProperties.LTE,
	sqonFieldOperatorProperties.BETWEEN,
	sqonFieldOperatorProperties.WILDCARD,
] as const;

export const SQON_IN_LIKE_OPS = [
	sqonFieldOperatorProperties.IN,
	sqonFieldOperatorProperties.NOT_IN,
	sqonFieldOperatorProperties.SOME_NOT_IN,
] as const;

export const SQON_RANGE_LIKE_OPS = [
	sqonFieldOperatorProperties.GT,
	sqonFieldOperatorProperties.GTE,
	sqonFieldOperatorProperties.LT,
	sqonFieldOperatorProperties.LTE,
] as const;

export const SQON_IN_LIKE_ALIASES = [
	sqonAliasProperties.IN,
	sqonAliasProperties.IN_DOUBLE,
	sqonAliasProperties.IN_TRIPLE,
	sqonAliasProperties.NOT_IN,
	sqonAliasProperties.NOT_IN_DOUBLE,
] as const;

export const SQON_RANGE_LIKE_ALIASES = [
	sqonAliasProperties.GT,
	sqonAliasProperties.GTE,
	sqonAliasProperties.LT,
	sqonAliasProperties.LTE,
] as const;

export const SQON_OP_ALIASES = {
	[sqonAliasProperties.FILTER]: sqonFieldOperatorProperties.WILDCARD,
	[sqonAliasProperties.GT]: sqonFieldOperatorProperties.GT,
	[sqonAliasProperties.GTE]: sqonFieldOperatorProperties.GTE,
	[sqonAliasProperties.IN]: sqonFieldOperatorProperties.IN,
	[sqonAliasProperties.IN_DOUBLE]: sqonFieldOperatorProperties.IN,
	[sqonAliasProperties.IN_TRIPLE]: sqonFieldOperatorProperties.IN,
	[sqonAliasProperties.LT]: sqonFieldOperatorProperties.LT,
	[sqonAliasProperties.LTE]: sqonFieldOperatorProperties.LTE,
	[sqonAliasProperties.NOT_IN]: sqonFieldOperatorProperties.NOT_IN,
	[sqonAliasProperties.NOT_IN_DOUBLE]: sqonFieldOperatorProperties.NOT_IN,
} as const;

export const RANGE_APPLICABLE_TYPES = ['long', 'integer', 'float', 'double', 'date'] as const;
export const STRING_OR_NUMBER_ARRAY = 'string | number | Array<string | number>';
