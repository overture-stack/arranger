import type { Prettify, RecursivePartial } from '#utils/types.js';

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

export type ThemeAggregatorFn = <Theme extends object = BaseThemeInterface>(
	partial: CustomThemeType<Theme> | CustomThemeType<Theme>[],
) => ThemeOptions;

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
