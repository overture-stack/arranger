/**
 * The events the adapter logs: its callback's, once per application of a result or refusal, and its
 * startup checks', once per finding.
 */
export const ACCESS_CONTROL_EVENTS = Object.freeze({
	categoryMatchesNoRecord: 'access_control.category_matches_no_record',
	conditionRefused: 'access_control.condition_refused',
	denied: 'access_control.denied',
	permitted: 'access_control.permitted',
	startupCheckFailed: 'access_control.startup_check_failed',
	unavailable: 'access_control.unavailable',
});
