import type { GetServerSideFilterFn } from '@overture-stack/arranger-types/configs';

/**
 * The filter applied when a deployment configures no access control: it must match every document.
 *
 * Expressed as the negation of a match-nothing leaf rather than as an empty combination. Both
 * compile to match-all, but an empty combination is a value that filter *reduction* can arrive at
 * by pruning, so allow-all would be indistinguishable from a restrictive filter that had been
 * reduced down to nothing. Carrying a leaf makes this shape unreachable by pruning, which is what
 * lets `compileFilter` reject a server-side filter that has no clauses left without also rejecting
 * a deployment that legitimately has no access control.
 *
 * The field is inert: an empty value list matches nothing whatever field it names, so `_id` is
 * chosen only because every document has one.
 */
const getDefaultServerSideFilter: GetServerSideFilterFn = () => ({
	op: 'not',
	content: [
		{
			op: 'in',
			content: {
				fieldName: '_id',
				value: [],
			},
		},
	],
});

export default getDefaultServerSideFilter;
