import type { CountDisplayThemeProps } from '#Table/CountDisplay/types.js';
import type { ThemeCommon } from '#ThemeContext/types/index.js';
import type { RecursivePartial } from '#utils/types.js';

export interface ToolbarThemeProps extends ThemeCommon.FontProperties, ThemeCommon.CustomCSS {
	CountDisplay: CountDisplayThemeProps;
}

export interface ToolbarProps extends ThemeCommon.CustomCSS {
	theme?: RecursivePartial<ToolbarThemeProps>;
}
