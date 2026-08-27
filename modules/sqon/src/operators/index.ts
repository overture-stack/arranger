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

/** Matches the operator-selection table in docs/reference/03-building-sqon-queries.md. */
const OPERATOR_DESCRIPTIONS: Record<(typeof SQON_FIELD_OPS)[number], string> = {
	all: 'Field contains all of these values (multi-valued field only).',
	between: 'Field is between these two values, both inclusive.',
	gt: 'Field is greater than this value.',
	gte: 'Field is greater than or equal to this value.',
	in: 'Field matches any of these values.',
	lt: 'Field is less than this value.',
	lte: 'Field is less than or equal to this value.',
	'not-in': 'Field does not match any of these values.',
	'some-not-in': 'At least one nested item is excluded (multi-valued, per-item).',
	wildcard: 'One or more fields contain this substring pattern.',
};

export const getSqonFieldOperatorDetails = (): SqonFieldOperatorDetail[] =>
	SQON_FIELD_OPS.map((op) => {
		const description = OPERATOR_DESCRIPTIONS[op];

		switch (op) {
			case 'all':
				return {
					applicableTo: 'all',
					description,
					fieldRef: 'fieldName' as const,
					op,
					valueType: 'Array<string | number | boolean>',
				};

			case 'between':
				return {
					applicableTo: [...RANGE_APPLICABLE_TYPES],
					description,
					fieldRef: 'fieldName' as const,
					op,
					valueType: 'Array<number | date>',
				};

			case 'gt':
			case 'gte':
			case 'lt':
			case 'lte':
				return {
					applicableTo: [...RANGE_APPLICABLE_TYPES],
					description,
					fieldRef: 'fieldName' as const,
					op,
					valueType: 'number | date',
				};

			case 'wildcard':
				return {
					applicableTo: 'all',
					description,
					fieldRef: 'fieldNames' as const,
					op,
					valueType: 'string',
				};

			default:
				return {
					applicableTo: 'all',
					description,
					fieldRef: 'fieldName' as const,
					op,
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
