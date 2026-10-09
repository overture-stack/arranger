/**
 * The names Arranger owns that the suites assert on: the adapter's log events, and how the GraphQL
 * router marks the refusal a suspended principal's export or write meets. Held in one place, so a
 * rename touches one file, beside the check telling that refusal from a configuration failure.
 */

/** The fixed message of each event the adapter's callback logs. */
export const EVENTS = {
	denied: 'access_control.denied',
	permitted: 'access_control.permitted',
	unavailable: 'access_control.unavailable',
} as const;

/** The name the GraphQL router recognizes its temporary refusal by, as it recognizes `AccessControlError`. */
export const UNAVAILABLE_ERROR_NAME = 'AccessControlUnavailableError';

/** The GraphQL error code of that refusal, distinct from the configuration failure's. */
export const UNAVAILABLE_GRAPHQL_CODE = 'ACCESS_CONTROL_UNAVAILABLE';

/**
 * Whether `error` refuses a misconfiguration, which the GraphQL router answers with its configuration
 * failure, rather than asking the client to try again later.
 *
 * @param error anything thrown.
 */
export const isConfigurationRefusal = (error: unknown): boolean =>
	error instanceof Error && error.name !== UNAVAILABLE_ERROR_NAME;
