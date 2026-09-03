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

export const InLikeFilterSchema = zod
	.object({
		op: InLikeOpSchema,
		content: zod
			.object({
				fieldName: zod.string().min(1),
				value: SqonScalarOrArrayValueSchema,
			})
			.passthrough(),
		pivot: zod.union([zod.string(), zod.null()]).optional(),
	})
	.passthrough();

export const AllFilterSchema = zod
	.object({
		op: zod.literal('all'),
		content: zod
			.object({
				fieldName: zod.string().min(1),
				value: zod.array(SqonScalarValueSchema).min(1),
			})
			.passthrough(),
		pivot: zod.union([zod.string(), zod.null()]).optional(),
	})
	.passthrough();

export const RangeLikeFilterSchema = zod
	.object({
		op: RangeLikeOpSchema,
		content: zod
			.object({
				fieldName: zod.string().min(1),
				value: SqonScalarOrArrayValueSchema,
			})
			.passthrough(),
		pivot: zod.union([zod.string(), zod.null()]).optional(),
	})
	.passthrough();

export const BetweenFilterSchema = zod
	.object({
		op: zod.literal('between'),
		content: zod
			.object({
				fieldName: zod.string().min(1),
				value: zod.array(SqonScalarValueSchema).length(2),
			})
			.passthrough(),
		pivot: zod.union([zod.string(), zod.null()]).optional(),
	})
	.passthrough();

export const WildcardFilterSchema = zod
	.object({
		op: zod.union([zod.literal('wildcard'), zod.literal('filter')]),
		content: zod
			.object({
				fieldNames: zod.array(zod.string().min(1)).min(1),
				value: zod.string(),
			})
			.passthrough(),
		pivot: zod.union([zod.string(), zod.null()]).optional(),
	})
	.passthrough();

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
	zod
		.object({
			op: GroupOpSchema,
			// eslint-disable-next-line @typescript-eslint/no-use-before-define -- deferred by zod.lazy
			content: zod.array(SqonNodeSchema),
			pivot: zod.union([zod.string(), zod.null()]).optional(),
		})
		.passthrough(),
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
