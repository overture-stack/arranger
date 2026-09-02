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

export const SqonCombinationSchema: zod.ZodType<SqonCombination, SqonCombination> = zod.lazy(() =>
	zod
		.object({
			op: GroupOpSchema,
			// eslint-disable-next-line @typescript-eslint/no-use-before-define -- deferred by zod.lazy
			content: zod.array(SqonNodeSchema),
			pivot: zod.union([zod.string(), zod.null()]).optional(),
		})
		.passthrough(),
);

/** The structural schema, without the depth guard. Not for direct use; see {@link SqonSchema}. */
const SqonNodeSchema: zod.ZodType<SqonNode, SqonNode> = zod.lazy(() =>
	zod.union([SqonCombinationSchema, SqonLeafSchema]),
);

/**
 * A SQON: a single filter leaf, or a combination of them.
 *
 * Piped so the depth check runs *before* the recursive parse. `safeParse` is documented never to
 * throw, but the recursion above overflows the stack on a deeply nested value, which escapes as a
 * `RangeError`. SQONs arrive as untrusted request content, so that is a crash reachable with about
 * 25KB of JSON. The pipe short-circuits: an over-deep value fails validation and never recurses.
 */
export const SqonSchema: zod.ZodType<SqonNode, unknown> = zod
	.unknown()
	.superRefine((value, ctx) => {
		if (!checkSqonDepth(value)) {
			ctx.addIssue({
				code: 'custom',
				message: `SQON nests deeper than the maximum JSON nesting depth of ${SQON_MAX_DEPTH}.`,
			});
		}
	})
	.pipe(SqonNodeSchema);

export type { SqonCombination, SqonLeaf, SqonNode } from './types.js';
