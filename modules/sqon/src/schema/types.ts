import type { z as zod } from 'zod';

import type { GroupOpSchema } from './constants.js';

import type {
	AllFilterSchema,
	BetweenFilterSchema,
	InLikeFilterSchema,
	RangeLikeFilterSchema,
	WildcardFilterSchema,
} from './index.js';

export type SqonLeaf =
	| zod.infer<typeof InLikeFilterSchema>
	| zod.infer<typeof AllFilterSchema>
	| zod.infer<typeof RangeLikeFilterSchema>
	| zod.infer<typeof BetweenFilterSchema>
	| zod.infer<typeof WildcardFilterSchema>;
export type SqonCombination = {
	op: zod.infer<typeof GroupOpSchema>;
	content: SqonNode[];
	pivot?: string | null;
	[key: string]: unknown;
};

export type SqonNode = SqonLeaf | SqonCombination;
