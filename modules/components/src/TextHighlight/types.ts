import type { ThemeCommon } from '#ThemeContext/types/index.js';

export interface TextHighlightThemeProps extends ThemeCommon.NonButtonThemeProps {
	wrapperClassName?: string;
	wrapperCSS?: ThemeCommon.cssInterpolation;
}
