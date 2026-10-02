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

export default includeEverything;
