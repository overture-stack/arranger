export {
	RANGE_APPLICABLE_TYPES,
	SCALAR_OR_ARRAY_VALUE_TYPE,
	SQON_COMBINATION_OPS,
	SQON_FIELD_OPS,
	SQON_IN_LIKE_ALIASES,
	SQON_IN_LIKE_OPS,
	SQON_OP_ALIASES,
	SQON_RANGE_LIKE_ALIASES,
	SQON_RANGE_LIKE_OPS,
	sqonAliasProperties,
	sqonCombinationProperties,
	sqonFieldOperatorProperties,
} from './constants.js';
import {
	RANGE_APPLICABLE_TYPES,
	SCALAR_OR_ARRAY_VALUE_TYPE,
	SQON_COMBINATION_OPS,
	SQON_FIELD_OPS,
	SQON_OP_ALIASES,
} from './constants.js';
import type { SqonAcceptedOp, SqonCanonicalOp, SqonFieldOperatorDetail, SqonOpAlias } from './types.js';

const SQON_CANONICAL_OPS_SET = new Set<string>([...SQON_COMBINATION_OPS, ...SQON_FIELD_OPS]);

export const isSqonCanonicalOp = (op: string): op is SqonCanonicalOp => SQON_CANONICAL_OPS_SET.has(op);

export const isSqonOpAlias = (op: string): op is SqonOpAlias => op in SQON_OP_ALIASES;

export const normalizeSqonOp = (op: SqonAcceptedOp): SqonCanonicalOp => {
	return isSqonOpAlias(op) ? SQON_OP_ALIASES[op] : op;
};

export const getSqonFieldOperatorDetails = (): SqonFieldOperatorDetail[] =>
	SQON_FIELD_OPS.map((op) => {
		switch (op) {
			case 'all':
				return {
					op,
					fieldRef: 'fieldName' as const,
					applicableTo: 'all',
					valueType: 'Array<string | number | boolean>',
				};

			case 'between':
				return {
					op,
					fieldRef: 'fieldName' as const,
					applicableTo: [...RANGE_APPLICABLE_TYPES],
					valueType: 'Array<number | date>',
				};

			case 'gt':
			case 'gte':
			case 'lt':
			case 'lte':
				return {
					op,
					fieldRef: 'fieldName' as const,
					applicableTo: [...RANGE_APPLICABLE_TYPES],
					valueType: 'number | date',
				};

			case 'wildcard':
				return {
					op,
					fieldRef: 'fieldNames' as const,
					applicableTo: 'all',
					valueType: 'string',
				};

			default:
				return {
					op,
					fieldRef: 'fieldName' as const,
					applicableTo: 'all',
					valueType: SCALAR_OR_ARRAY_VALUE_TYPE,
				};
		}
	});

export type {
	SqonAcceptedOp,
	SqonCanonicalOp,
	SqonCombinationOp,
	SqonFieldOp,
	SqonFieldOperatorDetail,
	SqonOpAlias,
	SqonRangeApplicableType,
} from './types.js';
