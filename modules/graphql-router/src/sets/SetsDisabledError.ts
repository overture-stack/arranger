/** The fixed message a client is given when a request uses saved sets on a server where they are not enabled. */
export const SETS_DISABLED_MESSAGE = 'Saved sets are not enabled on this server.';

/**
 * The fixed message a client is given when a request uses saved sets on a catalogue whose sets index could not be
 * resolved, so they are unavailable though enabled.
 */
export const SETS_UNAVAILABLE_MESSAGE = 'Saved sets are unavailable on this server.';

/**
 * A request used saved sets on a server where they are not enabled, or on a catalogue whose saved sets are
 * unavailable. Its message is fixed and never names the request's values, so a route can show it to the client who
 * sent the request.
 */
export class SetsDisabledError extends Error {
	name = 'SetsDisabledError';

	/**
	 * @param options.unavailable whether the catalogue has saved sets enabled but no usable sets index, which takes
	 *   the unavailable message rather than the disabled one.
	 */
	constructor({ unavailable = false }: { unavailable?: boolean } = {}) {
		super(unavailable ? SETS_UNAVAILABLE_MESSAGE : SETS_DISABLED_MESSAGE);
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
