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
 * GraphQL endpoint answers it with `ACCESS_ENFORCEMENT_UNAVAILABLE_CODE` and `ACCESS_ENFORCEMENT_UNAVAILABLE_MESSAGE`,
 * and the export route with `503`, that text and `Retry-After`, each logging its `message` on the server as
 * `access_enforcement.unavailable_answered`. It is never logged as `access_enforcement.evaluation_failed`, since
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
export const ACCESS_ENFORCEMENT_UNAVAILABLE_CODE = 'ACCESS_ENFORCEMENT_UNAVAILABLE';

/**
 * The only text a client is given for an `AccessControlUnavailableError`, exported so an integration's own
 * export route can answer the same.
 */
export const ACCESS_ENFORCEMENT_UNAVAILABLE_MESSAGE =
	'The server cannot apply its access control to this request yet. Try the request again later.';

/**
 * Whether `error` is an `AccessControlUnavailableError`, recognized by its name so one raised by
 * another copy of this module counts too.
 *
 * @param error anything caught.
 */
export const isAccessControlUnavailableError = (error: unknown): error is AccessControlUnavailableError =>
	error instanceof Error && error.name === 'AccessControlUnavailableError';

/**
 * Why a filter callback denied a request its catalogue: `no-access`, the principal has no access to it;
 * `access-too-broad`, their access is more than the catalogue's filter can express; `misconfigured`, access
 * control is configured wrongly for it. The first is the person's to raise, the other two the operator's to fix.
 */
export type AccessControlDenialKind = 'access-too-broad' | 'misconfigured' | 'no-access';

const denialTextFor = (kind: AccessControlDenialKind, catalogue: string): string => {
	switch (kind) {
		case 'access-too-broad':
			return `Your access is more than the filter of catalogue "${catalogue}" can express, so its records were not served.`;
		case 'no-access':
			return `You have no access to catalogue "${catalogue}".`;
		default:
			return `The server could not apply its access control to catalogue "${catalogue}" because of a problem in its configuration, not in this request.`;
	}
};

/**
 * A filter callback's denial of a request's catalogue, thrown in place of a filter so the catalogue's index is
 * never searched. Its `message` is the router's fixed text for its kind, naming the catalogue, written for the
 * client. The GraphQL endpoint answers `no-access` with `ACCESS_ENFORCEMENT_DENIED_CODE` and the export route with
 * `403`; the other kinds are answered as a problem on the server, `INTERNAL_SERVER_ERROR` and `500`. Each answer
 * is built from the kind and the catalogue alone, so nothing else the thrower says reaches a client, and logged
 * as `access_enforcement.denial_answered`, at info for `no-access` and at error otherwise.
 */
export class AccessControlDeniedError extends Error {
	override name = 'AccessControlDeniedError';

	/** The catalogue denied, as clients know it. */
	readonly catalogue: string;

	/** Why it was denied. */
	readonly kind: AccessControlDenialKind;

	/**
	 * @param details the catalogue denied, why, and an optional `cause`.
	 */
	constructor({ catalogue, cause, kind }: { catalogue: string; cause?: unknown; kind: AccessControlDenialKind }) {
		super(denialTextFor(kind, catalogue), { cause });
		this.catalogue = catalogue;
		this.kind = kind;
	}
}

/** The GraphQL error code a `no-access` denial is answered with. */
export const ACCESS_ENFORCEMENT_DENIED_CODE = 'ACCESS_ENFORCEMENT_DENIED';

/**
 * Whether `error` is an `AccessControlDeniedError`, recognized by its name so one raised by another copy of
 * this module counts too.
 *
 * @param error anything caught.
 */
export const isAccessControlDeniedError = (error: unknown): error is AccessControlDeniedError =>
	error instanceof Error && error.name === 'AccessControlDeniedError';

const DENIAL_KINDS: readonly string[] = ['access-too-broad', 'misconfigured', 'no-access'];

/**
 * What a client is told of `denied` and how its answer is logged: its kind, read as `misconfigured` when it is
 * none the router knows, as from another copy of this module, and the router's text for it.
 *
 * @param denied a denial, possibly raised by another copy of this module.
 */
export const denialAnswerOf = (
	denied: AccessControlDeniedError,
): { catalogue: string; kind: AccessControlDenialKind; text: string } => {
	const kind = DENIAL_KINDS.includes(denied.kind) ? denied.kind : 'misconfigured';
	const catalogue = String(denied.catalogue);

	return { catalogue, kind, text: denialTextFor(kind, catalogue) };
};

/** The GraphQL error code an `AccessControlQueryTooLargeError` is answered with. */
export const ACCESS_ENFORCEMENT_QUERY_TOO_LARGE_CODE = 'ACCESS_ENFORCEMENT_QUERY_TOO_LARGE';

/**
 * The search engine refused a read as larger than it accepts once the catalogue's access filter was applied.
 * Its `message` is fixed text naming the catalogue, written for the client. The GraphQL endpoint answers it
 * with `ACCESS_ENFORCEMENT_QUERY_TOO_LARGE_CODE` and the export route with a 500, each logging
 * `access_enforcement.query_too_large` with the catalogue, the read path and the engine's clause limit, and an
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
