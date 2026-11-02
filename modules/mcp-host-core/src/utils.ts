// General-purpose helpers, holding no host-core concept, shared across the module.

/** Whether `value` is a plain object: not `null`, and not an array. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Whether `value` is an array whose every entry passes `check`.
 *
 * @param value - Anything, such as a field read back from storage.
 * @param check - The guard each entry must pass.
 */
export const isArrayOf = <T>(value: unknown, check: (entry: unknown) => entry is T): value is T[] =>
	Array.isArray(value) && value.every(check);

/**
 * Parses JSON text without throwing.
 *
 * @param text - Text that may or may not be JSON.
 * @returns The parsed value, or `undefined` when the text is not JSON, which no JSON text parses to.
 */
export const parseJson = (text: string): unknown => {
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
};

/** The message of anything thrown: an `Error`'s own, or the value as a string. */
export const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * Settles with `promise`, or rejects with the signal's reason when `signal` aborts first.
 *
 * @remarks
 * The promise itself is not cancelled: it runs on, and its result is ignored.
 */
export const untilAborted = <T>(promise: Promise<T>, signal: AbortSignal): Promise<T> =>
	new Promise<T>((resolve, reject) => {
		const onAbort = () => reject(signal.reason);
		signal.throwIfAborted();
		signal.addEventListener('abort', onAbort, { once: true });
		promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
	});

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
