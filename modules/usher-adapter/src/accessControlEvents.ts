/** The name each access-enforcement event is logged under, one per outcome of a read or a startup check. */
export const ACCESS_CONTROL_EVENTS = Object.freeze({
	categoryMatchesNoRecord: 'access_enforcement.category_matches_no_record',
	conditionRefused: 'access_enforcement.condition_refused',
	denied: 'access_enforcement.denied',
	permitted: 'access_enforcement.permitted',
	startupCheckFailed: 'access_enforcement.startup_check_failed',
	unavailable: 'access_enforcement.unavailable',
});
