import { z as zod } from 'zod';

import {
	InLikeOpSchema,
	RangeLikeOpSchema,
	SqonScalarOrArrayValueSchema,
	SqonScalarValueSchema,
	GroupOpSchema,
} from './constants.js';
export type { SqonScalar, SqonScalarOrArray } from './constants.js';
import type { SqonGroup, SqonNode } from './types.js';

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

export const FuzzyFilterSchema = zod
	.object({
		op: zod.literal('filter'),
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
	FuzzyFilterSchema,
]);

export const SqonGroupSchema: zod.ZodType<SqonGroup> = zod.lazy(() =>
	zod
		.object({
			op: GroupOpSchema,
			content: zod.array(SqonSchema),
			pivot: zod.union([zod.string(), zod.null()]).optional(),
		})
		.passthrough(),
);

export const SqonSchema: zod.ZodType<SqonNode> = zod.lazy(() => zod.union([SqonGroupSchema, SqonLeafSchema]));

export type { SqonGroup, SqonLeaf, SqonNode } from './types.js';
