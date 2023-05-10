import { RecursivePartial } from '@/utils/types';

import { Components } from './components';
import { Shape } from './shape';
import { Spacing } from './spacing';
import { Colors, Palette } from './palette';

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

export type ThemeProcessorFn = {
	<Theme = BaseThemeInterface>(inputTheme: RecursivePartial<Theme>): RecursivePartial<Theme>;
	callerName?: string;
};

export type CustomThemeType<Theme = BaseThemeInterface> =
	| RecursivePartial<Theme>
	| ThemeProcessorFn;

export type ThemeAggregatorFn = <Theme extends object = BaseThemeInterface>(
	partial: CustomThemeType<Theme> | CustomThemeType<Theme>[],
) => ThemeOptions;

export type ThemeMergerFn = {
	<Theme = CustomThemeType>(targetTheme: ThemeOptions, partialTheme: Theme | Theme[]): ThemeOptions;
	callerName?: string;
};

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

export * as ThemeCommon from './common';
