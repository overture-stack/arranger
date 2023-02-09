import { CountDisplayThemeProps } from '@/Table/CountDisplay/types';
import { ThemeCommon } from '@/ThemeContext/types';

export interface ToolbarThemeProps extends ThemeCommon.FontProperties {
	CountDisplay: CountDisplayThemeProps;
}

export interface ToolbarProps extends ThemeCommon.CustomCSS {
	theme?: Partial<ToolbarThemeProps>;
}
