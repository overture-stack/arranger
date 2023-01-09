import { Components, ComponentsOptions } from './components';
import { Shape, ShapeOptions } from './shape';
import { Spacing, SpacingOptions } from './spacing';
import { Colors, ColorsOptions, Palette, PaletteOptions } from './palette';

export interface BaseThemeInterface {
  colors?: Colors;
  components?: Components;
  palette: Palette;
  shadows?: unknown;
  shape: Shape;
  spacing: Spacing;
  typography?: unknown;
  zIndex?: unknown;
}

export interface ThemeOptions {
  colors?: ColorsOptions;
  components?: ComponentsOptions;
  palette?: PaletteOptions;
  shadows?: unknown;
  shape?: ShapeOptions;
  spacing?: SpacingOptions;
  typography?: unknown;
  zIndex?: Record<string, number>;
}

export type ThemeProcessorFn = {
  <Theme = BaseThemeInterface>(inputTheme: Theme): Theme;
  callerName?: string;
};

export type CustomThemeType<Theme = BaseThemeInterface> = Theme | ThemeProcessorFn;

export type ThemeAggregatorFn = <Theme extends object = BaseThemeInterface>(
  partial: CustomThemeType<Theme> | CustomThemeType<Theme>[],
) => ThemeOptions;

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

export type UseThemeContextProps = CustomThemeType<ThemeOptions> & {
  callerName?: string;
};

export interface WithThemeProps<Theme = ThemeOptions> {
  theme?: Theme;
}

export * as ThemeCommon from './common';
