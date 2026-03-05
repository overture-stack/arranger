// SQON Canonicals definition

export const SQON_COMBINATION_OPS = ['and', 'or', 'not'] as const;
export type SqonCombinationOp = (typeof SQON_COMBINATION_OPS)[number];

export const SQON_FIELD_OPS = [
	'in',
	'not-in',
	'some-not-in',
	'all',
	'gt',
	'gte',
	'lt',
	'lte',
	'between',
	'filter',
] as const;
export type SqonFieldOp = (typeof SQON_FIELD_OPS)[number];

export type SqonCanonicalOp = SqonCombinationOp | SqonFieldOp;

const SQON_CANONICAL_OPS_SET = new Set<string>([...SQON_COMBINATION_OPS, ...SQON_FIELD_OPS]);

export const isSqonCanonicalOp = (op: string): op is SqonCanonicalOp => SQON_CANONICAL_OPS_SET.has(op);

// SQON Aliases definition

export const SQON_OP_ALIASES = {
	'>': 'gt',
	'<': 'lt',
	'>=': 'gte',
	'<=': 'lte',
	'=': 'in',
	'==': 'in',
	'===': 'in',
	'!=': 'not-in',
	'!==': 'not-in',
} as const;
export type SqonOpAlias = keyof typeof SQON_OP_ALIASES;

export type SqonAcceptedOp = SqonCanonicalOp | SqonOpAlias;

export const isSqonOpAlias = (op: string): op is SqonOpAlias => op in SQON_OP_ALIASES;

export const normalizeSqonOp = (op: SqonAcceptedOp): SqonCanonicalOp => {
	return isSqonOpAlias(op) ? SQON_OP_ALIASES[op] : op;
};
