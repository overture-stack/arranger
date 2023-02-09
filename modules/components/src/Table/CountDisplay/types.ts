import { SpinnerThemeProps } from '@/Spinner/types';
import { ThemeCommon } from '@/ThemeContext/types';

export interface CountDisplayThemeProps extends ThemeCommon.FontProperties {
	hideLoader: boolean;

	// Child components
	Spinner: Partial<SpinnerThemeProps>;
}

export interface CountDisplayProps extends ThemeCommon.CustomCSS {
	theme?: Partial<CountDisplayThemeProps>;
}
