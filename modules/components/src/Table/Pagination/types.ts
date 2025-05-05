import type { MaxRowsSelectorThemeProps } from '#Table/MaxRowsSelector/types.js';
import type { PageSelectorThemeProps } from '#Table/PageSelector/types.js';
import type { ThemeCommon } from '#ThemeContext/types/index.js';
import type { RecursivePartial } from '#utils/types.js';

export interface PaginationThemeProps extends ThemeCommon.FontProperties {
	MaxRowSelector: MaxRowsSelectorThemeProps;
	PageSelector: PageSelectorThemeProps;
}

export interface PaginationProps extends ThemeCommon.CustomCSS {
	theme?: RecursivePartial<PaginationThemeProps>;
}
