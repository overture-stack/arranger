import type {
	RANGE_APPLICABLE_TYPES,
	SQON_COMBINATION_OPS,
	SQON_FIELD_OPS,
	SQON_OP_ALIASES,
} from './constants.js';

export type SqonCombinationOp = (typeof SQON_COMBINATION_OPS)[number];
export type SqonFieldOp = (typeof SQON_FIELD_OPS)[number];
export type SqonCanonicalOp = SqonCombinationOp | SqonFieldOp;
export type SqonOpAlias = keyof typeof SQON_OP_ALIASES;
export type SqonAcceptedOp = SqonCanonicalOp | SqonOpAlias;
export type SqonRangeApplicableType = (typeof RANGE_APPLICABLE_TYPES)[number];

export type SqonFieldOperatorDetail = {
	op: SqonFieldOp;
	applicableTo: 'all' | SqonRangeApplicableType[];
	valueType: string;
};
