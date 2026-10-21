/**
 * The events the adapter logs: its callback's, once per application of a result or refusal, and its
 * startup checks', once per finding.
 */
export const ACCESS_CONTROL_EVENTS = Object.freeze({
	categoryMatchesNoRecord: 'access_enforcement.category_matches_no_record',
	conditionRefused: 'access_enforcement.condition_refused',
	denied: 'access_enforcement.denied',
	permitted: 'access_enforcement.permitted',
	startupCheckFailed: 'access_enforcement.startup_check_failed',
	unavailable: 'access_enforcement.unavailable',
});
