const isProperSqon = (sqon) => !!(sqon && sqon.op);

/**
 * A node with no leaf compiles to an empty `bool`, which Elasticsearch treats as match-all.
 * Recursive because `{op:'and', content:[{op:'and', content:[]}]}` has a non-empty top level and
 * still matches everything.
 */
const hasNoLeafClause = (sqon) => Array.isArray(sqon?.content) && sqon.content.every(hasNoLeafClause);

// TODO: when filtering separates from the GraphQL layer, move to its vocabulary; see
// `.dev/docs/atlas/layers-and-vocabulary.md`. `serverSideFilter` becomes `constraint`, and
// `clientSideFilter` and `disableClientFilters` take the requested filter's name once that is
// settled. The TSDoc below then has to define a constraint outright, since the one used when nothing
// is configured matches every document and reads as permissive. The error messages keep the router's
// names on purpose: a deployment author can only act through `getServerSideFilter`, so translate there.

/**
 * Composes the caller's filter with the deployment's access-control filter.
 *
 * Only the server-side filter is validated: a client filter restricting nothing is an ordinary
 * unfiltered query, while a server-side one restricting nothing is an access-control failure of
 * the same shape. Throwing beats denying, which would look like a query that matched nothing.
 *
 * `disableClientFilters` drops the caller's filter here rather than at the request handler, which
 * can only guess which variable holds one. By this point it is a parsed SQON however it arrived.
 *
 * @throws {Error} when the server-side filter is absent, or has no clauses to apply.
 */
export default ({ clientSideFilter, disableClientFilters = false, serverSideFilter }) => {
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

	const applicableClientFilter = !disableClientFilters && isProperSqon(clientSideFilter);

	return {
		op: 'and',
		content: [
			applicableClientFilter
				? clientSideFilter
				: {
						op: 'and',
						content: [],
					},
			serverSideFilter,
		],
	};
};
