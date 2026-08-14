import { omit } from 'lodash-es';
import {
	type ComponentType,
	createContext,
	type ReactElement,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';

import getComponentDisplayName from '#utils/getComponentDisplayName.js';
import missingProviderHandler from '#utils/missingProvider.js';
import { emptyObj } from '#utils/noops.js';

import arrangerBaseTheme from './baseTheme/index.js';
import type {
	BaseThemeInterface,
	ThemeAggregatorFn,
	ThemeContextInterface,
	ThemeContribution,
	ThemeOptions,
	ThemeProcessorFn,
	ThemeProviderProps,
	UseThemeContextProps,
	WithThemeProps,
} from './types/index.js';
import { isProviderNested, mergeThemes, updateThemeContribution } from './utils.js';

export const ThemeContext = createContext<ThemeContextInterface<ThemeOptions>>({
	missingProvider: 'ThemeContext',
	theme: {},
} as ThemeContextInterface<ThemeOptions>);

// Shared registry key for a contribution made without a callerKey (calling aggregateTheme directly
// via context rather than through useThemeContext, which always supplies one). Kept simple: a later
// anonymous call replaces an earlier one rather than merging onto it, consistent with every other
// registry entry, rather than reintroducing the never-unsettable-accumulator problem this file
// exists to fix.
const ANONYMOUS_CALLER_KEY = 'anonymous-theme-caller';

// Explicitly typed rather than reusing the generic `noopFn`: TypeScript can't reliably unify
// `noopFn`'s own generic signature with `ThemeAggregatorFn`'s, since both have their own default
// type parameters.
const noopAggregateTheme: ThemeAggregatorFn = () => undefined;

/** hook for theme access and aggregation
 * @param {Theme} [customTheme] takes customisation parameters for Arranger components.
 * @returns {Theme} theme object
 */
export const useThemeContext = (customTheme: UseThemeContextProps = emptyObj): ThemeOptions => {
	const { aggregateTheme = noopAggregateTheme, missingProvider, theme } = useContext(ThemeContext);
	// Falls back to a per-instance generated key when the caller doesn't supply callerName, so an
	// anonymous contribution still replaces its own prior value across re-renders of this same
	// component instance, rather than being merged onto indefinitely (see aggregateTheme below).
	const fallbackKeyRef = useRef<string>();
	fallbackKeyRef.current ??= `anonymous-theme-caller-${Math.random().toString(36).slice(2)}`;
	const callerKey = customTheme.callerName || fallbackKeyRef.current;

	useEffect(() => {
		aggregateTheme<ThemeOptions>(typeof customTheme === 'function' ? customTheme : omit(customTheme, 'callerName'), callerKey);
	}, [aggregateTheme, callerKey, customTheme, theme]);

	missingProvider && missingProviderHandler(ThemeContext.displayName, customTheme.callerName);

	return useMemo(() => theme, [theme]);
};

// Each caller's contribution is tracked separately, keyed by callerKey, and replaced wholesale
// (never merged into) on every call from that same caller. The effective theme is then re-derived
// by folding the base theme with every contribution, in the order each caller first appeared. This
// is what lets a caller's later, smaller/different theme value actually take effect: a single
// ever-growing merge accumulator (the previous design) can only add to or override keys present in
// a new value, never remove a key, shrink an array, or otherwise reflect a caller's value getting
// smaller, since there is nothing in the "smaller" value to overlay onto the stale remainder.

const useAggregableTheme = (baseTheme: ThemeOptions): readonly [ThemeOptions, ThemeAggregatorFn] => {
	const [contributions, setContributions] = useState<Record<string, ThemeContribution>>(emptyObj);

	const aggregateTheme = useCallback<ThemeAggregatorFn>((partialTheme, callerKey = ANONYMOUS_CALLER_KEY) => {
		setContributions((previousContributions) => updateThemeContribution(previousContributions, callerKey, partialTheme));
	}, []);

	const theme = useMemo(
		() => mergeThemes(baseTheme, Object.values(contributions)),
		[baseTheme, contributions],
	);

	return [theme, aggregateTheme] as const; // make tuple type
};

/** Context provider for Arranger's theme functionalities
 * @param {Theme} [theme] allows giving the provider a custom version of the theme for the consumers.
 * @param {boolean} [useArrangerTheme=true] tells the provider to source the default Arranger theme. (optional, default: `true`)
 */
export const ThemeProvider = <Theme extends BaseThemeInterface>({
	children,
	theme: localTheme,
	useArrangerTheme = true,
}: ThemeProviderProps): ReactElement<ThemeContextInterface<Theme>> => {
	const outerTheme = useThemeContext({ callerName: ThemeContext.displayName }); // get theme from parent theme provider, if any.
	const initialTheme = useArrangerTheme ? arrangerBaseTheme : emptyObj;
	// const isNested = isProviderNested(initialTheme, [outerTheme, localTheme]);
	// const otherThemes = [outerTheme, localTheme, isNested];
	const otherThemes = localTheme ? [outerTheme, localTheme] : outerTheme;

	const [theme, aggregateTheme] = useAggregableTheme(mergeThemes(initialTheme, otherThemes));

	const contextValues = {
		aggregateTheme,
		theme,
	};

	return <ThemeContext.Provider value={contextValues}>{children}</ThemeContext.Provider>;
};

/** HOC for theme access
 * @param {ComponentType} Component the component you want to provide Arranger data to.
 */
export const withTheme = <Props extends JSX.IntrinsicAttributes>(Component: ComponentType) => {
	const callerName = getComponentDisplayName(Component);
	const ThemedComponent = ({ theme: customTheme, ...props }: WithThemeProps<ThemeOptions> & Props) => {
		if (typeof customTheme === 'function') {
			(customTheme as ThemeProcessorFn).callerName = callerName;
		}
		const theme = useThemeContext(customTheme || { callerName });

		const themedProps = {
			...props,
			theme,
		};

		return <Component {...themedProps} />;
	};

	ThemedComponent.displayName = `WithArrangerTheme(${callerName})`;

	return ThemedComponent;
};

if (process.env.NODE_ENV === 'development') {
	ThemeContext.displayName = 'ArrangerThemeContext';
	ThemeProvider.displayName = 'ArrangerThemeProvider';
}

export * as arrangerTheme from './baseTheme/index.js';
export * as themeUtils from './utils.js';
