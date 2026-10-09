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

/**
 * A filter callback's refusal to serve a request yet, as distinct from a configuration failure. The
 * GraphQL endpoint answers it with `ACCESS_CONTROL_UNAVAILABLE_CODE` and its `message`, and the export
 * route with `503`, its `message` and `Retry-After`, so its `message` is written for the client. It is
 * never logged as `access_control.evaluation_failed`, since nothing is misconfigured.
 */
export class AccessControlUnavailableError extends Error {
	override name = 'AccessControlUnavailableError';

	/** How long a client waits before retrying, in whole seconds. */
	readonly retryAfterSeconds: number;

	/**
	 * @param message the text a client is answered with.
	 * @param options `retryAfterSeconds`, the wait a client is told, and an optional `cause`.
	 */
	constructor(message: string, { cause, retryAfterSeconds }: { cause?: unknown; retryAfterSeconds: number }) {
		super(message, { cause });
		this.retryAfterSeconds = retryAfterSeconds;
	}
}

/** The GraphQL error code an `AccessControlUnavailableError` is answered with. */
export const ACCESS_CONTROL_UNAVAILABLE_CODE = 'ACCESS_CONTROL_UNAVAILABLE';

/**
 * Whether `error` is an `AccessControlUnavailableError`, recognized by its name so one raised by
 * another copy of this module counts too.
 *
 * @param error anything caught.
 */
export const isAccessControlUnavailableError = (error: unknown): error is AccessControlUnavailableError =>
	error instanceof Error && error.name === 'AccessControlUnavailableError';
