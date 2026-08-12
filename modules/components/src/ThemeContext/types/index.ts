import type { RecursivePartial } from '#utils/types.js';

import type { Components } from './components.js';
import type { Colors, Palette } from './palette.js';
import type { Shape } from './shape.js';
import type { Spacing } from './spacing.js';

export interface BaseThemeInterface {
	colors: Colors;
	components: Components;
	palette: Palette;
	shadows: unknown;
	shape: Shape;
	spacing: Spacing;
	typography: unknown;
	zIndex: Record<string, number>;
}

export type ThemeOptions = RecursivePartial<BaseThemeInterface>;

export interface ThemeProcessorFn {
	<Theme = BaseThemeInterface>(inputTheme: RecursivePartial<Theme>): RecursivePartial<Theme>;
	callerName?: string;
}

export type CustomThemeType<Theme = BaseThemeInterface> = RecursivePartial<Theme> | ThemeProcessorFn;

// What one caller can contribute in a single call: not narrowed to any one call's particular
// shape, since the same caller's contribution can legitimately differ in shape (e.g. a key
// present or not) from one call to the next.
export type ThemeContribution = CustomThemeType | CustomThemeType[];

// No return value: the aggregated theme is read from ThemeContext's own `theme`, not from calling
// this. It only ever updates the registry as a side effect.
export type ThemeAggregatorFn = <Theme extends object = BaseThemeInterface>(
	partial: CustomThemeType<Theme> | CustomThemeType<Theme>[],
	// Identifies which caller a contribution belongs to, so a later call from the same caller
	// replaces its own prior contribution instead of merging onto it. Omit for a one-off,
	// anonymous contribution that never needs to be replaced.
	callerKey?: string,
) => void;

export interface ThemeMergerFn {
	<Theme = CustomThemeType>(targetTheme: ThemeOptions, partialTheme: Theme | Theme[]): ThemeOptions;
	callerName?: string;
}

export interface ThemeContextInterface<Theme = ThemeOptions> {
	aggregateTheme: ThemeAggregatorFn;
	missingProvider?: string;
	theme: Theme;
}

export interface ThemeProviderProps<Theme = ThemeOptions> {
	children?: React.ReactNode;
	location?: string; // helpful for troubleshooting multiple theme providers
	theme?: CustomThemeType<Theme>;
	useArrangerTheme?: boolean;
}

export type UseThemeContextProps<Theme = ThemeOptions> = CustomThemeType<Theme> & {
	callerName?: string;
};

export interface WithThemeProps<Theme = ThemeOptions> {
	theme?: RecursivePartial<Theme>;
}

export type * as ThemeCommon from './common.js';
