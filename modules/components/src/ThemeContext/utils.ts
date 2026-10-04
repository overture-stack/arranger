import { isEqualWith, mergeWith } from 'lodash-es';

import { emptyObj } from '#utils/noops.js';

import type { CustomThemeType, ThemeContribution, ThemeMergerFn, ThemeOptions, ThemeProcessorFn } from './types/index.js';

// lodash's default merge combines two arrays element-by-element by index, so a theme array
// (e.g. Table.defaultSorting) can never be fully replaced, only ever grown or partially
// overwritten: shrinking it, reordering it, or clearing it leaves stale trailing elements from
// the previous value. Treating an incoming array as a full replacement (rather than something to
// merge into) matches how every other theme value already behaves.
const replaceArrays = (_targetValue: unknown, sourceValue: unknown) =>
	Array.isArray(sourceValue) ? sourceValue : undefined;

// To support theme composition
const mergeTargetAndCustomTheme = <Theme = CustomThemeType>(targetTheme: ThemeOptions, customTheme: Theme) => {
	if (typeof customTheme === 'function') {
		const mergedTheme = customTheme(targetTheme);

		if (mergedTheme) {
			return mergedTheme;
		}

		const callerName = (customTheme as unknown as ThemeProcessorFn).callerName;

		if (process.env.NODE_ENV === 'development') {
			console.error(`Your customTheme function ${callerName ? `at ${callerName} ` : ''}should return an object`);
		}

		return targetTheme;
	}

	// Into a fresh object: lodash writes into the first argument's nested objects, so merging into the
	// target, or a shallow copy of it, would change themes other providers share, Arranger's base included.
	return mergeWith({}, targetTheme, customTheme, replaceArrays);
};

// Treats any two function values as equal, regardless of identity. An inline theme object (the
// common case: a consumer passing `{ ... }` literal on every render) recreates any function-valued
// property fresh each render, so comparing those by reference would make this "equal" check almost
// never actually true, defeating its purpose of skipping updates when nothing meaningful changed.
// The real cost: a change confined entirely to a function's body (not its presence/absence, not
// anything else in the theme) won't register as a change. That's a narrow, dev-time-only gap
// (e.g. editing a callback during Fast Refresh) rather than the common case, so it's an acceptable
// trade for avoiding a re-render on every single render of a normal, inline-callback-carrying theme.
const treatFunctionsAsEqual = (a: unknown, b: unknown) => (typeof a === 'function' && typeof b === 'function' ? true : undefined);

export const isThemeEqual = (a: unknown, b: unknown): boolean => isEqualWith(a, b, treatFunctionsAsEqual);

// What the fold applies a caller's contribution to: the base, then every contribution before it.
const foldInputFor = (
	contributions: Record<string, ThemeContribution>,
	callerKey: string,
	base: ThemeOptions,
): ThemeOptions => {
	const keys = Object.keys(contributions);
	const position = keys.indexOf(callerKey);

	return mergeThemes(
		base,
		(position < 0 ? keys : keys.slice(0, position)).map((key) => contributions[key]),
	);
};

// Theme functions are compared by what they produce from the input the fold gives them, since a caller
// may build a new function on every render: equal results keep the update skipped, and a result that
// follows changed state, such as a light or dark toggle, registers as the change it is.
const isContributionEqual = (stored: unknown, incoming: unknown, inputOf: () => ThemeOptions): boolean => {
	if (typeof stored === 'function' && typeof incoming === 'function') {
		const input = inputOf();

		return isThemeEqual(stored(input), incoming(input));
	}

	return isThemeEqual(stored, incoming);
};

/**
 * Replaces a caller's registry entry wholesale rather than merging into it, so that caller's next
 * contribution correctly reflects removed keys, shrunk arrays, or any other way its value got
 * smaller, not just bigger. Returns the exact same `contributions` reference when nothing changed
 * for this caller, so a consumer using this as a React state updater gets a correct bail-out
 * (React skips the re-render when a state updater returns the same reference it was given).
 *
 * A contribution that is a theme function is compared by applying the stored and the incoming function to
 * the theme the fold gives it: `base`, then every contribution before this caller's. Theme functions must
 * be pure, returning the same theme for the same input. One whose result changes between calls, from a
 * clock, a random value or a counter, never compares equal, so it updates the theme on every render and
 * re-renders without end.
 *
 * @param base the provider's base theme, which the fold starts from.
 */
export const updateThemeContribution = (
	contributions: Record<string, ThemeContribution>,
	callerKey: string,
	partialTheme: ThemeContribution,
	base: ThemeOptions = emptyObj,
): Record<string, ThemeContribution> =>
	isContributionEqual(contributions[callerKey], partialTheme, () => foldInputFor(contributions, callerKey, base))
		? contributions
		: { ...contributions, [callerKey]: partialTheme };

/**
 * Removes a caller's registry entry, for an instance that unmounts. Returns the same `contributions`
 * reference when the caller has none, so a React state updater bails out.
 */
export const removeThemeContribution = (
	contributions: Record<string, ThemeContribution>,
	callerKey: string,
): Record<string, ThemeContribution> => {
	if (callerKey in contributions) {
		const { [callerKey]: _removed, ...remaining } = contributions;

		return remaining;
	}

	return contributions;
};

// export const mergeThemes: ThemeMergerFn = (targetTheme, partialTheme) =>
export const mergeThemes: ThemeMergerFn = (targetTheme, partialTheme) =>
	Array.isArray(partialTheme)
		? partialTheme.reduce((aggregated, partial) => mergeTargetAndCustomTheme(aggregated, partial), targetTheme)
		: mergeTargetAndCustomTheme(targetTheme, partialTheme);

export const nested =
	typeof Symbol === 'function' && Symbol.for // has symbol
		? Symbol.for('theme.nested')
		: '__THEME_NESTED__';

const getObjKeyCount = (obj = emptyObj) => Object.keys(obj).length;

const checkThemingFunction = (theme: (args?: any) => any) => {
	if (process.env.NODE_ENV === 'development') {
		typeof theme?.() === 'object' ||
			console.info(
				[
					'You are providing a theme function to the ThemeProvider:',
					'<ThemeProvider theme={outerTheme => outerTheme} />',
					'',
					'As no theme has been set, make sure the function returns a theme object.',
					'however, in this case, we recommend setting up a base theme instead',
				].join('\n'),
			);
	}
};

export const isProviderNested = (initialTheme = emptyObj, otherThemes: any[] = [emptyObj]) => {
	const hasValidInitialTheme = getObjKeyCount(initialTheme) > 0;
	const totalValidParents = otherThemes.filter((theme = emptyObj, index) => {
		if (typeof theme === 'function') {
			// Make sure a theme is already injected higher in the tree or provide a theme object instead of a function
			return !hasValidInitialTheme && index === 0 && checkThemingFunction(theme);
		} else if (typeof theme === 'object') {
			return getObjKeyCount(theme);
		}
	}).length;

	const isNested = initialTheme ? hasValidInitialTheme && totalValidParents : totalValidParents > 1;

	return isNested && { [nested]: true };
};
