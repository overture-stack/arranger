import { z as zod } from 'zod';

import {
	SQON_COMBINATION_OPS,
	SQON_IN_LIKE_ALIASES,
	SQON_IN_LIKE_OPS,
	SQON_RANGE_LIKE_ALIASES,
	SQON_RANGE_LIKE_OPS,
} from '#operators/index.js';

export const GroupOpSchema = zod.enum(SQON_COMBINATION_OPS);

export const SqonCanonicalInLikeOpSchema = zod.enum(SQON_IN_LIKE_OPS);
export const SqonCanonicalRangeLikeOpSchema = zod.enum(SQON_RANGE_LIKE_OPS);

export const SqonAliasInLikeOpSchema = zod.enum(SQON_IN_LIKE_ALIASES);
export const SqonAliasRangeLikeOpSchema = zod.enum(SQON_RANGE_LIKE_ALIASES);

export const InLikeOpSchema = zod.union([SqonCanonicalInLikeOpSchema, SqonAliasInLikeOpSchema]);
export const RangeLikeOpSchema = zod.union([SqonCanonicalRangeLikeOpSchema, SqonAliasRangeLikeOpSchema]);
export const SqonScalarValueSchema = zod.union([zod.string(), zod.number()]);
export const SqonScalarOrArrayValueSchema = zod.union([SqonScalarValueSchema, zod.array(SqonScalarValueSchema)]);
