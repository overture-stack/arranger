import { CountDisplayThemeProps } from '@/Table/CountDisplay/types';
import { ThemeCommon } from '@/ThemeContext/types';
import { RecursivePartial } from '@/utils/types';

export interface ToolbarThemeProps extends ThemeCommon.FontProperties, ThemeCommon.CustomCSS {
	CountDisplay: CountDisplayThemeProps;
}

export interface ToolbarProps extends ThemeCommon.CustomCSS {
	theme?: RecursivePartial<ToolbarThemeProps>;
}
