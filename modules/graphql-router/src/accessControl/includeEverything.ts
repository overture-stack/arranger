import { isDeepStrictEqual } from 'node:util';

import type { GetServerSideFilterFn } from '@overture-stack/arranger-types/configs';

/**
 * The filter callback that keeps every document whatever the context: what a router given nothing
 * applies, and what a callback returns to allow one request without restricting it.
 */
const includeEverything: GetServerSideFilterFn<unknown> = () => ({
	// A negated match-nothing leaf rather than an empty combination. Both match everything, but filter
	// reduction can prune a restrictive filter down to an empty combination, which is why compileFilter
	// refuses one; carrying a leaf keeps this shape out of reach of pruning. The field is inert, since an
	// empty value list matches nothing whatever field it names.
	content: [
		{
			content: {
				fieldName: '_id',
				value: [],
			},
			op: 'in',
		},
	],
	op: 'not',
});

/**
 * Whether `filter` is the one `includeEverything` returns, alone or as every member of an `and`, so it
 * restricts no record. Recognized by its shape, so a filter built by another copy of this package counts too.
 *
 * @param filter a server-side filter, as a callback returned it.
 */
export const isIncludeEverythingFilter = (filter: unknown): boolean =>
	isDeepStrictEqual(filter, includeEverything(undefined)) ||
	(typeof filter === 'object' &&
		filter !== null &&
		'op' in filter &&
		filter.op === 'and' &&
		'content' in filter &&
		Array.isArray(filter.content) &&
		filter.content.length > 0 &&
		filter.content.every(isIncludeEverythingFilter));

export default includeEverything;
