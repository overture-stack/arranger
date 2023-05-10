import { MaxRowsSelectorThemeProps } from '@/Table/MaxRowsSelector/types';
import { PageSelectorThemeProps } from '@/Table/PageSelector/types';
import { ThemeCommon } from '@/ThemeContext/types';
import { RecursivePartial } from '@/utils/types';

export interface PaginationThemeProps extends ThemeCommon.FontProperties {
	MaxRowSelector: MaxRowsSelectorThemeProps;
	PageSelector: PageSelectorThemeProps;
}

export interface PaginationProps extends ThemeCommon.CustomCSS {
	theme?: RecursivePartial<PaginationThemeProps>;
}
