import type { LoaderThemeProps } from '#Loader/types.js';
import type { ThemeCommon } from '#ThemeContext/types/index.js';
import type { RecursivePartial } from '#utils/types.js';

export interface CountDisplayThemeProps extends ThemeCommon.FontProperties {
	hideLoader: boolean;

	// Child components
	Loader: LoaderThemeProps;
}

export interface CountDisplayProps extends ThemeCommon.CustomCSS {
	theme?: RecursivePartial<CountDisplayThemeProps>;
}
