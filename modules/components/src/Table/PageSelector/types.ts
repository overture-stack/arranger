import type { ThemeCommon } from '#ThemeContext/types/index.js';
import type { RecursivePartial } from '#utils/types.js';

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
	theme?: RecursivePartial<PageSelectorThemeProps>;
}
