/** The fixed message a client is given when a request uses saved sets on a server where they are not enabled. */
export const SETS_DISABLED_MESSAGE = 'Saved sets are not enabled on this server.';

/**
 * A request used saved sets on a server where they are not enabled. Its message is fixed and never names the
 * request's values, so a route can show it to the client who sent the request.
 */
export class SetsDisabledError extends Error {
	name = 'SetsDisabledError';

	constructor() {
		super(SETS_DISABLED_MESSAGE);
	}
}

/**
 * Whether `error` is a `SetsDisabledError`, recognized by its name so one raised by another copy of this module
 * counts too.
 *
 * @param error anything caught.
 */
export const isSetsDisabledError = (error: unknown): error is SetsDisabledError =>
	error instanceof Error && error.name === 'SetsDisabledError';
