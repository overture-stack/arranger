import type { ThemeCommon } from '#ThemeContext/types/index.js';
import type { RecursivePartial } from '#utils/types.js';

export interface InputThemeProps
	extends ThemeCommon.BoxModelProperties,
		ThemeCommon.CustomCSS,
		ThemeCommon.FontProperties {
	ClearButton: React.ReactNode;
	clearButtonAltText: string;
	Components: React.ReactNode;
	showClear: boolean;
}

export interface InputProps extends ThemeCommon.CustomCSS {
	theme?: RecursivePartial<InputThemeProps>;
}
