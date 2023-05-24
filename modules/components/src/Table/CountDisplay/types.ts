import { LoaderThemeProps } from '@/Loader/types';
import { ThemeCommon } from '@/ThemeContext/types';
import { RecursivePartial } from '@/utils/types';

export interface CountDisplayThemeProps extends ThemeCommon.FontProperties {
	hideLoader: boolean;

	// Child components
	Loader: LoaderThemeProps;
}

export interface CountDisplayProps extends ThemeCommon.CustomCSS {
	theme?: RecursivePartial<CountDisplayThemeProps>;
}
