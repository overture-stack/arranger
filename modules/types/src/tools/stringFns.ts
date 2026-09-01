const TRUTHY_VALUES = ['true', '1', 'yes', 'on'];
const FALSY_VALUES = ['false', '0', 'no', 'off'];

/**
 * Parses an environment string into a boolean, trimming and lowercasing first.
 *
 * Warns on a value matching neither list rather than coercing it silently. Every `DISABLE_*` flag
 * reads through here, so an unrecognized value leaves a hardening flag off while the operator
 * believes it is on: `DISABLE_FILTERS=yes` used to parse as `false`, and a single trailing space
 * from a Helm value or `.env` line did the same to `true`.
 *
 * @param str the raw value; `undefined` or blank yields `fallback`.
 * @param fallback returned when nothing was configured.
 * @returns the parsed boolean, or `false` for a value in neither list.
 */
export const stringToBool = (str: string | undefined, fallback = false) => {
	if (str === undefined) {
		return fallback;
	}

	const normalized = str.trim().toLocaleLowerCase();

	if (normalized === '') {
		return fallback;
	}

	if (TRUTHY_VALUES.includes(normalized)) {
		return true;
	}

	if (FALSY_VALUES.includes(normalized)) {
		return false;
	}

	console.warn(
		`Unrecognized boolean value "${str}", treated as false. Expected one of: ${[...TRUTHY_VALUES, ...FALSY_VALUES].join(', ')}.`,
	);
	return false;
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
