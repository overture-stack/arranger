const isProperSqon = (sqon) => !!(sqon && sqon.op);

/**
 * True when a SQON node contains no leaf clause at any depth.
 *
 * Such a node compiles to a `bool` with an empty clause array, which Elasticsearch treats as
 * match-all. The check has to recurse: `{op:'and', content:[{op:'and', content:[]}]}` has a
 * non-empty top level and still compiles to match-all.
 *
 * `Array.isArray` distinguishes a combination (content is an array of children) from a leaf
 * (content is an object carrying `fieldName`), and `every` on an empty array is true, which is
 * the empty-combination base case.
 */
const hasNoLeafClause = (sqon) => Array.isArray(sqon?.content) && sqon.content.every(hasNoLeafClause);

/**
 * Composes the caller's filter with the deployment's access-control filter.
 *
 * The server-side filter is validated and the client's is not, deliberately: a client filter that
 * restricts nothing is an ordinary unfiltered query, while a server-side filter that restricts
 * nothing is an access-control failure wearing the same shape. Rejecting is louder than falling
 * back to a deny, because a silent deny is indistinguishable from a query that legitimately
 * matched nothing, and every defect on this path so far has been one that failed silently.
 *
 * @throws {Error} when the server-side filter is absent, or has no clauses to apply.
 */
export default ({ clientSideFilter, serverSideFilter }) => {
	if (!isProperSqon(serverSideFilter)) {
		throw new Error(
			'compileFilter: a server-side filter is required. A `getServerSideFilter` callback must ' +
				'return a SQON node for every request, including unauthenticated ones. To apply no ' +
				'access control, return `getDefaultServerSideFilter()` explicitly.',
		);
	}

	if (hasNoLeafClause(serverSideFilter)) {
		throw new Error(
			`compileFilter: the server-side filter is an empty '${serverSideFilter.op}' combination, ` +
				'which matches every document. To deny a request, return a filter that matches nothing ' +
				'(an `in` with an empty value list). To apply no access control, return ' +
				'`getDefaultServerSideFilter()`.',
		);
	}

	return {
		op: 'and',
		content: [
			isProperSqon(clientSideFilter)
				? clientSideFilter
				: {
						op: 'and',
						content: [],
					},
			serverSideFilter,
		],
	};
};
