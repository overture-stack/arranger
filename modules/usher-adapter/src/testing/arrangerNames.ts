/**
 * The names Arranger owns that the suites assert on: the adapter's log events, and how the GraphQL
 * router marks a denial of the catalogue and the refusal a suspended principal's export or write meets.
 * Held in one place, so a rename touches one file, beside the check telling those from a configuration
 * failure.
 */

/** The fixed message of each event the adapter logs: its callback's, and its startup checks'. */
export const EVENTS = {
	categoryMatchesNoRecord: 'access_enforcement.category_matches_no_record',
	conditionRefused: 'access_enforcement.condition_refused',
	denied: 'access_enforcement.denied',
	permitted: 'access_enforcement.permitted',
	startupCheckFailed: 'access_enforcement.startup_check_failed',
	unavailable: 'access_enforcement.unavailable',
} as const;

/** The name the GraphQL router recognizes a callback's denial of the catalogue by. */
export const DENIED_ERROR_NAME = 'AccessControlDeniedError';

/** A kind of denial, as the GraphQL router names it. */
export type DenialKind = 'access-too-broad' | 'misconfigured' | 'no-access';

/**
 * What a client is answered for each kind of denial of `catalogue`: the GraphQL error code, the export's status
 * and the GraphQL router's text, forbidden for the person's own lack of access and a server problem otherwise.
 */
export const denialAnswerFor = (
	kind: DenialKind,
	catalogue: string,
): Readonly<{ code: string; status: number; text: string }> => {
	switch (kind) {
		case 'access-too-broad':
			return {
				code: 'INTERNAL_SERVER_ERROR',
				status: 500,
				text: `Your access is more than the filter of catalogue "${catalogue}" can express, so its records were not served.`,
			};
		case 'misconfigured':
			return {
				code: 'INTERNAL_SERVER_ERROR',
				status: 500,
				text: `The server could not apply its access control to catalogue "${catalogue}" because of a problem in its configuration, not in this request.`,
			};
		case 'no-access':
			return {
				code: 'ACCESS_ENFORCEMENT_DENIED',
				status: 403,
				text: `You have no access to catalogue "${catalogue}".`,
			};
	}
};

/** The name the GraphQL router recognizes its temporary refusal by, as it recognizes `AccessControlError`. */
export const UNAVAILABLE_ERROR_NAME = 'AccessControlUnavailableError';

/** The GraphQL error code of that refusal, distinct from the configuration failure's. */
export const UNAVAILABLE_GRAPHQL_CODE = 'ACCESS_ENFORCEMENT_UNAVAILABLE';

/**
 * Whether `error` refuses a misconfiguration, which the GraphQL router answers with its configuration
 * failure, rather than denying the catalogue or asking the client to try again later.
 *
 * @param error anything thrown.
 */
export const isConfigurationRefusal = (error: unknown): boolean =>
	error instanceof Error && error.name !== DENIED_ERROR_NAME && error.name !== UNAVAILABLE_ERROR_NAME;
