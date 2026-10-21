import type { FilterReadPath } from '@overture-stack/arranger-types/configs';

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
 * GraphQL endpoint answers it with `ACCESS_CONTROL_UNAVAILABLE_CODE` and `ACCESS_CONTROL_UNAVAILABLE_MESSAGE`,
 * and the export route with `503`, that text and `Retry-After`, each logging its `message` on the server as
 * `access_control.unavailable_answered`. It is never logged as `access_control.evaluation_failed`, since
 * nothing is misconfigured.
 */
export class AccessControlUnavailableError extends Error {
	override name = 'AccessControlUnavailableError';

	/** How long a client waits before retrying, in whole seconds. */
	readonly retryAfterSeconds: number;

	/**
	 * @param message why the request cannot be served yet, logged on the server.
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
 * The only text a client is given for an `AccessControlUnavailableError`, exported so an integration's own
 * export route can answer the same.
 */
export const ACCESS_CONTROL_UNAVAILABLE_MESSAGE =
	'The server cannot apply its access control to this request yet. Try the request again later.';

/**
 * Whether `error` is an `AccessControlUnavailableError`, recognized by its name so one raised by
 * another copy of this module counts too.
 *
 * @param error anything caught.
 */
export const isAccessControlUnavailableError = (error: unknown): error is AccessControlUnavailableError =>
	error instanceof Error && error.name === 'AccessControlUnavailableError';

/** The GraphQL error code an `AccessControlQueryTooLargeError` is answered with. */
export const ACCESS_CONTROL_QUERY_TOO_LARGE_CODE = 'ACCESS_CONTROL_QUERY_TOO_LARGE';

/**
 * The search engine refused a read as larger than it accepts once the catalogue's access filter was applied.
 * Its `message` is fixed text naming the catalogue, written for the client. The GraphQL endpoint answers it
 * with `ACCESS_CONTROL_QUERY_TOO_LARGE_CODE` and the export route with a 500, each logging
 * `access_control.query_too_large` with the catalogue, the read path and the engine's clause limit, and an
 * integration catching it from `getAllData` or `dataStream` should do the same.
 */
export class AccessControlQueryTooLargeError extends Error {
	override name = 'AccessControlQueryTooLargeError';

	/** The catalogue whose access filter the refused read applied. */
	readonly catalogue: string;

	/** The engine's clause limit, or undefined where its refusal names none. */
	readonly clauseLimit: number | undefined;

	/** The read the engine refused. */
	readonly readPath: FilterReadPath;

	/**
	 * @param details the catalogue, the read path, the engine's clause limit where known, and the engine's
	 *   refusal as `cause`.
	 */
	constructor({
		catalogue,
		cause,
		clauseLimit,
		readPath,
	}: {
		catalogue: string;
		cause?: unknown;
		clauseLimit: number | undefined;
		readPath: FilterReadPath;
	}) {
		super(
			`The search engine refused this request to catalogue "${catalogue}" as larger than it accepts once the catalogue's access filter was applied.`,
			{ cause },
		);
		this.catalogue = catalogue;
		this.clauseLimit = clauseLimit;
		this.readPath = readPath;
	}
}

/**
 * Whether `error` is an `AccessControlQueryTooLargeError`, recognized by its name so one raised by another
 * copy of this module counts too.
 *
 * @param error anything caught.
 */
export const isAccessControlQueryTooLargeError = (error: unknown): error is AccessControlQueryTooLargeError =>
	error instanceof Error && error.name === 'AccessControlQueryTooLargeError';
