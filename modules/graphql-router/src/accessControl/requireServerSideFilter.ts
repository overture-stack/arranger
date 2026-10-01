import { AccessControlError } from './AccessControlError.js';

const INTENT_ADVICE =
	'To allow a request without restricting it, return `includeEverything(context)`. ' +
	'A deployment with no access control passes nothing to the router as `getServerSideFilter`.';

const ABSENT_FILTER_REFUSAL =
	'A server-side filter is required. A `getServerSideFilter` callback must return a SQON node for every ' +
	`request, including unauthenticated ones. ${INTENT_ADVICE}`;

const emptyCombinationRefusal = (operator: unknown): string =>
	`The server-side filter is an empty '${String(operator)}' combination, which matches every document. ` +
	'To deny a request, return a filter that matches nothing (an `in` with an empty value list). ' +
	INTENT_ADVICE;

const isFilterNode = (filter: unknown): filter is { op: unknown } =>
	typeof filter === 'object' && filter !== null && 'op' in filter && Boolean(filter.op);

/**
 * A node with no leaf compiles to an empty `bool`, which Elasticsearch treats as match-all.
 * Recursive because `{op:'and', content:[{op:'and', content:[]}]}` has a non-empty top level and
 * still matches everything.
 */
const hasLeafClause = (node: unknown): boolean => {
	const content = typeof node === 'object' && node !== null && 'content' in node ? node.content : undefined;

	return Array.isArray(content) ? content.some(hasLeafClause) : true;
};

/**
 * Returns `serverSideFilter` when it is a SQON node carrying a leaf clause, and refuses it otherwise,
 * advising what to return instead for each intent: denying a request, allowing one, or applying no
 * access control.
 *
 * @param serverSideFilter the filter a callback returned.
 * @throws {AccessControlError} when the filter is absent, is not a SQON node, or is a combination with
 *   no leaf clause at any depth.
 */
export const requireServerSideFilter = <Filter>(serverSideFilter: Filter): Filter => {
	if (isFilterNode(serverSideFilter) && hasLeafClause(serverSideFilter)) {
		return serverSideFilter;
	}

	throw new AccessControlError(
		isFilterNode(serverSideFilter) ? emptyCombinationRefusal(serverSideFilter.op) : ABSENT_FILTER_REFUSAL,
	);
};
