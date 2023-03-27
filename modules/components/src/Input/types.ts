import { ThemeCommon } from '@/ThemeContext/types';

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
	theme?: Partial<InputThemeProps>;
}
