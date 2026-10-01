/**
 * Access control could not be evaluated for a request: a filter callback threw or returned a thenable,
 * its filter was absent or an empty combination, or no filter could be resolved at all. It is a refusal
 * to serve the request, distinct from a bad request and from a search-engine fault. The GraphQL
 * endpoint and network search's node `errors` answer it with fixed text, logging `message` and
 * `cause` on the server only, and an integration catching it from `getAllData` or `dataStream`
 * should do the same.
 */
export class AccessControlError extends Error {
	override name = 'AccessControlError';
}

/** The only text a client is given in place of an `AccessControlError`. */
export const ACCESS_CONTROL_FAILURE_MESSAGE = 'Access control could not be evaluated for this request.';

/**
 * Whether `error` is an `AccessControlError`, recognized by its name so one raised by another copy of
 * this module counts too.
 *
 * @param error anything caught.
 */
export const isAccessControlError = (error: unknown): error is AccessControlError =>
	error instanceof Error && error.name === 'AccessControlError';
