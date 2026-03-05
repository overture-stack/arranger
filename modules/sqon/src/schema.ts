import { z as zod } from 'zod';

import { SQON_OP_ALIASES } from './operators.js';

export const SqonScalarValueSchema = zod.union([zod.string(), zod.number()]);
export const SqonScalarOrArrayValueSchema = zod.union([SqonScalarValueSchema, zod.array(SqonScalarValueSchema)]);

const GroupOpSchema = zod.enum(['and', 'or', 'not']);

// Canonical SQON ops (preferred wire format)
export const SqonCanonicalInLikeOpSchema = zod.enum(['in', 'not-in', 'some-not-in']);
export const SqonCanonicalRangeLikeOpSchema = zod.enum(['gt', 'gte', 'lt', 'lte']);

// Alias ops (accepted for compatibility / shorthand parsing)
export const SqonAliasInLikeOpSchema = zod.enum(['=', '==', '===', '!=', '!==']);
export const SqonAliasRangeLikeOpSchema = zod.enum(['>', '>=', '<', '<=']);

// Accepted input ops (canonical + aliases)
const InLikeOpSchema = zod.union([SqonCanonicalInLikeOpSchema, SqonAliasInLikeOpSchema]);
const RangeLikeOpSchema = zod.union([SqonCanonicalRangeLikeOpSchema, SqonAliasRangeLikeOpSchema]);

const InLikeFilterSchema = zod
	.object({
		op: InLikeOpSchema,
		content: zod
			.object({
				fieldName: zod.string(),
				value: SqonScalarOrArrayValueSchema,
			})
			.passthrough(),
		pivot: zod.union([zod.string(), zod.null()]).optional(),
	})
	.passthrough();

const AllFilterSchema = zod
	.object({
		op: zod.literal('all'),
		content: zod
			.object({
				fieldName: zod.string(),
				value: SqonScalarOrArrayValueSchema,
			})
			.passthrough(),
		pivot: zod.union([zod.string(), zod.null()]).optional(),
	})
	.passthrough();

const RangeLikeFilterSchema = zod
	.object({
		op: RangeLikeOpSchema,
		content: zod
			.object({
				fieldName: zod.string(),
				value: SqonScalarOrArrayValueSchema,
			})
			.passthrough(),
		pivot: zod.union([zod.string(), zod.null()]).optional(),
	})
	.passthrough();

const BetweenFilterSchema = zod
	.object({
		op: zod.literal('between'),
		content: zod
			.object({
				fieldName: zod.string(),
				value: zod.union([SqonScalarValueSchema, zod.array(SqonScalarValueSchema).min(2)]),
			})
			.passthrough(),
		pivot: zod.union([zod.string(), zod.null()]).optional(),
	})
	.passthrough();

const FuzzyFilterSchema = zod
	.object({
		op: zod.literal('filter'),
		content: zod
			.object({
				fieldNames: zod.array(zod.string()).min(1),
				value: zod.string(),
			})
			.passthrough(),
		pivot: zod.union([zod.string(), zod.null()]).optional(),
	})
	.passthrough();

const SqonLeafSchema = zod.union([
	InLikeFilterSchema,
	AllFilterSchema,
	RangeLikeFilterSchema,
	BetweenFilterSchema,
	FuzzyFilterSchema,
]);

type SqonLeaf = zod.infer<typeof SqonLeafSchema>;
type SqonGroup = {
	op: zod.infer<typeof GroupOpSchema>;
	content: SqonNode[];
	pivot?: string | null;
	[key: string]: unknown;
};

export type SqonNode = SqonLeaf | SqonGroup;

export const SqonSchema: zod.ZodType<SqonNode> = zod.lazy(() =>
	zod.union([
		zod
			.object({
				op: GroupOpSchema,
				content: zod.array(SqonSchema),
				pivot: zod.union([zod.string(), zod.null()]).optional(),
			})
			.passthrough(),
		SqonLeafSchema,
	]),
);

export const sqonOpAliases = SQON_OP_ALIASES;
