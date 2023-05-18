import { SpinnerThemeProps } from '@/Spinner/types';
import { ThemeCommon } from '@/ThemeContext/types';
import { RecursivePartial } from '@/utils/types';

export interface CountDisplayThemeProps extends ThemeCommon.FontProperties {
	hideLoader: boolean;

	// Child components
	Spinner: SpinnerThemeProps;
}

export interface CountDisplayProps extends ThemeCommon.CustomCSS {
	theme?: RecursivePartial<CountDisplayThemeProps>;
}
