/**
 * Access control could not be evaluated for a request: a filter callback threw or returned a thenable;
 * its filter was absent, or held an empty combination, an `all` with no values, a range with no bound,
 * an exclusion with no value list, a clause naming no field, or an entry that is not a SQON node; or no
 * filter could be resolved at all.
 * It is a refusal to serve the request, distinct from a bad request and from a search-engine fault. The GraphQL
 * endpoint and network search's node `errors` answer it with fixed text, logging `message` and
 * `cause` on the server only, and an integration catching it from `getAllData` or `dataStream`
 * should do the same.
 */
export class AccessControlError extends Error {
	override name = 'AccessControlError';
}

/**
 * The only text a client is given in place of an `AccessControlError`, exported so an integration's own
 * export route can answer the same.
 */
export const ACCESS_CONTROL_FAILURE_MESSAGE =
	'The server could not apply its access control because of a problem in its configuration, not in this request.';

/**
 * Whether `error` is an `AccessControlError`, recognized by its name so one raised by another copy of
 * this module counts too.
 *
 * @param error anything caught.
 */
export const isAccessControlError = (error: unknown): error is AccessControlError =>
	error instanceof Error && error.name === 'AccessControlError';
