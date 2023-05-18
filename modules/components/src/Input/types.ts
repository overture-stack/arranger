import { ThemeCommon } from '@/ThemeContext/types';
import { RecursivePartial } from '@/utils/types';

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
