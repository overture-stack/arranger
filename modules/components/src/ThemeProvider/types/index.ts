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

export type ThemeProcessorFn = <Theme = BaseThemeInterface>(inputTheme: Theme) => Theme;
export type CustomThemeType<Theme = BaseThemeInterface> = Theme | ThemeProcessorFn;

export type ThemeAggregatorFn = <Theme = BaseThemeInterface>(
  partial: CustomThemeType<Theme> | CustomThemeType<Theme>[],
) => ThemeOptions;

export interface ThemeContextInterface<Theme = BaseThemeInterface> {
  aggregateTheme: ThemeAggregatorFn;
  theme: Theme;
}

export interface ThemeProviderProps<Theme = BaseThemeInterface> {
  children?: React.ReactNode;
  location?: string; // helpful for troubleshooting multiple theme providers
  theme?: CustomThemeType<Theme>;
  useArrangerTheme?: boolean;
}

export interface WithThemeProps<Theme = BaseThemeInterface> {
  theme?: Theme;
}
