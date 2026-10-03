/**
 * A filter breaks one of SQON's rules. Its message names the rule and never the filter's values, so a
 * route can show it to the client who sent the filter, as the download route does.
 */
export class InvalidFilterError extends Error {
	name = 'InvalidFilterError';
}

/**
 * Whether `error` is an `InvalidFilterError`, recognized by its name so one raised by another copy of
 * this module counts too.
 *
 * @param {unknown} error anything caught.
 * @returns {boolean}
 */
export const isInvalidFilterError = (error) => error instanceof Error && error.name === 'InvalidFilterError';
