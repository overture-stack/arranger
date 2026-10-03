import { z as zod } from 'zod';

import {
	InLikeOpSchema,
	RangeLikeOpSchema,
	SqonScalarOrArrayValueSchema,
	SqonScalarValueSchema,
	GroupOpSchema,
} from './constants.js';
import { checkSqonDepth, SQON_MAX_DEPTH } from './depth.js';
import type { SqonCombination, SqonNode } from './types.js';

export type { SqonScalar, SqonScalarOrArray } from './constants.js';

// The JSON Schema served through /introspection/sqon carries these, and
// docs/reference/04-sqon-in-detail.md says the same for people, so a change here belongs there too.
const PivotSchema = zod
	.union([zod.string(), zod.null()])
	.optional()
	.describe(
		'Path of a nested field that scopes this node: conditions under it on fields within that path are tested against one nested object at a time. A pivoted and or or matches a document when one of its nested objects satisfies the node; a pivoted not matches when none of its nested objects meets all of its conditions on that path. A pivot only scopes conditions: on a group with none, it has no effect, and the empty group matches every document. Without a pivot, conditions on a nested field may each be met by a different nested object. Must name a nested field of the catalogue being queried.',
	);

const FieldNameSchema = zod
	.string()
	.min(1)
	.describe(
		'Dotted path of the field this clause tests, such as donor.age. The key is fieldName: a clause that uses the key `field` instead names no field.',
	);

export const InLikeFilterSchema = zod.looseObject({
	op: InLikeOpSchema,
	content: zod.looseObject({
		fieldName: FieldNameSchema,
		value: SqonScalarOrArrayValueSchema.describe(
			'A value, or a list of values, that the field is tested against. With in, an empty list matches nothing.',
		),
	}),
	pivot: PivotSchema,
});

export const AllFilterSchema = zod.looseObject({
	op: zod.literal('all'),
	content: zod.looseObject({
		fieldName: FieldNameSchema,
		value: zod.array(SqonScalarValueSchema).min(1).describe('The values the field must all hold, at least one.'),
	}),
	pivot: PivotSchema,
});

export const RangeLikeFilterSchema = zod.looseObject({
	op: RangeLikeOpSchema,
	content: zod.looseObject({
		fieldName: FieldNameSchema,
		value: SqonScalarOrArrayValueSchema.describe(
			'The bound: a number, or a date string for a date field. Given a list, every bound applies, so the strictest one decides: the largest for gt and gte, the smallest for lt and lte.',
		),
	}),
	pivot: PivotSchema,
});

export const BetweenFilterSchema = zod.looseObject({
	op: zod.literal('between'),
	content: zod.looseObject({
		fieldName: FieldNameSchema,
		value: zod.array(SqonScalarValueSchema).length(2).describe('[min, max], both inclusive.'),
	}),
	pivot: PivotSchema,
});

export const WildcardFilterSchema = zod.looseObject({
	op: zod.union([zod.literal('wildcard'), zod.literal('filter')]),
	content: zod.looseObject({
		fieldNames: zod
			.array(zod.string().min(1))
			.min(1)
			.describe('The fields to search; a document matches if any one of them matches the pattern.'),
		value: zod.string(),
	}),
	pivot: PivotSchema,
});

export const SqonLeafSchema = zod.union([
	InLikeFilterSchema,
	AllFilterSchema,
	RangeLikeFilterSchema,
	BetweenFilterSchema,
	WildcardFilterSchema,
]);

/**
 * The structural schemas, unguarded. The recursion runs through these so the depth check fires once
 * at an entry point rather than re-walking every subtree at every nested level for the same answer.
 * Exported for `jsonSchema/runtime.ts`, which describes the data shape and so must not see the
 * guard's pipe, but deliberately absent from the package root: callers get the guarded pair below.
 */
export const SqonCombinationNodeSchema: zod.ZodType<SqonCombination, SqonCombination> = zod.lazy(() =>
	zod.looseObject({
		op: GroupOpSchema,
		// eslint-disable-next-line @typescript-eslint/no-use-before-define -- deferred by zod.lazy
		content: zod.array(SqonNodeSchema),
		pivot: PivotSchema,
	}),
);

export const SqonNodeSchema: zod.ZodType<SqonNode, SqonNode> = zod.lazy(() =>
	zod.union([SqonCombinationNodeSchema, SqonLeafSchema]),
);

/**
 * Checks nesting depth before `schema` parses, so an over-deep value fails validation instead of
 * overflowing the recursion. `safeParse` is documented never to throw, but the recursive descent
 * escapes as a `RangeError` on untrusted input of about 25KB. The pipe short-circuits, so the
 * recursion is never entered.
 */
const withDepthGuard = <Output>(schema: zod.ZodType<Output, Output>): zod.ZodType<Output, unknown> =>
	zod
		.unknown()
		.superRefine((value, ctx) => {
			if (!checkSqonDepth(value)) {
				ctx.addIssue({
					code: 'custom',
					message: `SQON exceeds the maximum nesting depth of ${SQON_MAX_DEPTH}, counted in JSON levels (roughly twice the number of nested filter combinations).`,
				});
			}
		})
		.pipe(schema);

/** A combination of SQON nodes under `and`, `or`, or `not`. */
export const SqonCombinationSchema: zod.ZodType<SqonCombination, unknown> = withDepthGuard(SqonCombinationNodeSchema);

/** A SQON: a single filter leaf, or a combination of them. */
export const SqonSchema: zod.ZodType<SqonNode, unknown> = withDepthGuard(SqonNodeSchema);

export type { SqonCombination, SqonLeaf, SqonNode } from './types.js';
