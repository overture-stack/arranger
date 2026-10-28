/** The longest delay a Node timer holds: a longer one fires at once rather than never. */
export const MAX_TIMER_MS = 2_147_483_647;

/**
 * Checks a timeout before a timer is set from it.
 *
 * @param name - The option's name, for the error.
 * @param ms - The timeout, in milliseconds.
 * @throws `TypeError` unless it is a finite, positive number of milliseconds no longer than {@link MAX_TIMER_MS}.
 */
export const assertTimeout = (name: string, ms: number): void => {
	if (!Number.isFinite(ms) || ms <= 0 || ms > MAX_TIMER_MS) {
		throw new TypeError(`${name} must be a positive number of milliseconds, at most ${MAX_TIMER_MS}`);
	}
};
