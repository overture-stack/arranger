import { ThemeCommon } from '@/ThemeContext/types';

export interface MaxRowsSelectorThemeProps extends ThemeCommon.NonButtonThemeProps {
	pageSizes: number[];
}

export interface MaxRowsSelectorProps extends ThemeCommon.CustomCSS {
	disabled?: boolean;
	theme?: Partial<MaxRowsSelectorThemeProps>;
}
