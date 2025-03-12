import type { ThemeCommon } from '#ThemeContext/types/index.js';
import type { RecursivePartial } from '#utils/types.js';

export interface MaxRowsSelectorThemeProps extends ThemeCommon.NonButtonThemeProps {
	pageSizes: number[];
}

export interface MaxRowsSelectorProps extends ThemeCommon.CustomCSS {
	disabled?: boolean;
	theme?: RecursivePartial<MaxRowsSelectorThemeProps>;
}
