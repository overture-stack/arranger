const ACCEPTED_BOOLEANS = new Map<unknown, boolean>([
	[0, false],
	[1, true],
	[false, false],
	[true, true],
	['0', false],
	['1', true],
	['false', false],
	['true', true],
]);

// JSON renders NaN and the infinities as null and throws on a bigint, so both kinds of number are
// named directly; anything else it cannot render is named by its type.
const describeIgnoredValue = (value: unknown): string => {
	if (typeof value === 'number') {
		return String(value);
	}

	if (typeof value === 'bigint') {
		return `${value}n`;
	}

	try {
		return JSON.stringify(value) ?? typeof value;
	} catch {
		return typeof value;
	}
};

/**
 * Reads a configuration value as a boolean. Accepts the booleans `true` and `false`, the numbers `1`
 * and `0`, and the strings `true` and `false` in any case and `1` and `0`, each trimmed.
 *
 * `undefined`, or a string that is empty once trimmed, means nothing was configured and returns
 * `fallback` silently. Any other value, `null` included, is ignored: it returns `fallback` too, and
 * warns, naming the value. A flag whose value is ignored keeps its default, which can leave a hardening
 * flag off while the operator believes it is on, so the warning is the only sign of the slip.
 *
 * Word pairs such as `yes`/`no` and `on`/`off` are left out on purpose: `no` and `on` are one
 * transposition apart and mean opposites, so accepting both would turn a slip into an inverted flag.
 *
 * @param value the configured value, usually an environment variable's raw text.
 * @param fallback returned when nothing was configured or the value is ignored.
 * @returns the value read as a boolean, or `fallback`.
 */
export const stringToBool = (value: unknown, fallback = false): boolean => {
	const normalized = typeof value === 'string' ? value.trim().toLowerCase() : value;
	const accepted = ACCEPTED_BOOLEANS.get(normalized);

	if (typeof accepted === 'boolean') {
		return accepted;
	}

	if (normalized === undefined || normalized === '') {
		return fallback;
	}

	console.warn(
		'config.boolean_value_ignored',
		`Ignored boolean value ${describeIgnoredValue(value)}, so the default, ${fallback}, applies. Expected true, false, 1 or 0.`,
	);
	return fallback;
};

/**
 * Parses an environment string into a finite number.
 *
 * Warns on an unparseable value rather than falling back silently. The fallback is a default, so a
 * typo in a limit an operator set to *tighten* below that default silently restores the looser
 * value: `MAX_RESULTS_WINDOW=5OOO` yields 10000 rather than the intended 5000.
 *
 * Overloaded so that supplying a fallback narrows the return to `number`. Without it, every caller
 * with a default had to write `stringToNumber(x) || fallback` to satisfy the type, and `||` discards
 * a legitimate `0`.
 *
 * @param str the raw value; `undefined` or blank yields `fallback`.
 * @param fallback returned when nothing was configured or the value does not parse.
 * @returns the parsed number, including `0`, or `fallback`.
 */
export function stringToNumber(str: string | undefined, fallback: number): number;
export function stringToNumber(str: string | undefined, fallback?: number): number | undefined;
export function stringToNumber(str: string | undefined, fallback?: number): number | undefined {
	if (str === undefined) {
		return fallback;
	}

	const trimmed = str.trim();

	if (trimmed === '') {
		return fallback;
	}

	const parsed = Number(trimmed);

	if (Number.isFinite(parsed)) {
		return parsed;
	}

	console.warn(`Value "${str}" is not a finite number, falling back to ${fallback}. Any limit it configures is not applied.`);
	return fallback;
};

/**
 * Parses JSON string into array or returns default of empty array
 *
 * @param str valid JSON string (hopefully)
 * @returns parsed array from string, a fallback value, or an empty array
 */
export const stringToArray = (str: string | undefined, fallback: unknown[] = []) => {
	try {
		const parsed = str && JSON.parse(str);
		if (Array.isArray(parsed)) {
			return parsed;
		}
	} catch (err) {
		console.error('Issue in types/stringToArray\n', err);
	}

	return fallback;
};
