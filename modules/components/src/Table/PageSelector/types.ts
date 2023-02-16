import { ThemeCommon } from '@/ThemeContext/types';

export interface PageSelectorThemeProps
	extends ThemeCommon.FontProperties,
		ThemeCommon.FontDisabledProperties,
		ThemeCommon.NonButtonThemeProps {
	ElementGroups: ThemeCommon.BoxModelProperties;
	borderErrorColor: string;
	showTotalPages: boolean;
	changePageOnTimeout: boolean;
}

export interface PageSelectorProps extends ThemeCommon.CustomCSS {
	theme?: Partial<PageSelectorThemeProps>;
}
