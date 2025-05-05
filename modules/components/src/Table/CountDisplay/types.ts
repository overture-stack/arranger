import type { LoaderThemeProps } from '#Loader/types.js';
import type { ThemeCommon } from '#ThemeContext/types/index.js';
import type { RecursivePartial } from '#utils/types.js';

export type CountDisplayThemeProps = {
	hideLoader: boolean;

	// Child components
	Loader: LoaderThemeProps;
	spacing: string;
} & ThemeCommon.FontProperties;

export type CountDisplayProps = {
	theme?: RecursivePartial<CountDisplayThemeProps>;
} & ThemeCommon.CustomCSS;
