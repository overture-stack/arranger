import { requireServerSideFilter } from '#accessControl/requireServerSideFilter.js';

const isProperSqon = (sqon) => !!(sqon && sqon.op);

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
 * @throws {AccessControlError} when the server-side filter is absent, or holds anywhere a part that
 *   would match broadly where nobody meant it to: an empty combination, an `all` with no values, a
 *   range with no bound, an exclusion with no value list, a clause naming no field, or an entry that
 *   is not a SQON node.
 */
export default ({ clientSideFilter, disableClientFilters = false, serverSideFilter }) => {
	const checkedServerSideFilter = requireServerSideFilter(serverSideFilter);
	const applicableClientFilter = !disableClientFilters && isProperSqon(clientSideFilter);

	return {
		content: applicableClientFilter ? [clientSideFilter, checkedServerSideFilter] : [checkedServerSideFilter],
		op: 'and',
	};
};
