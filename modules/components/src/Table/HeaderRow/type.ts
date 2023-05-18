import { HeaderGroup } from '@tanstack/react-table';

import { TableInnerBoxModelProperties } from '@/Table/types';
import { ThemeCommon } from '@/ThemeContext/types';
import { RecursivePartial } from '@/utils/types';

export interface HeaderRowThemeProps extends TableInnerBoxModelProperties {
	horizontalBorderColor: string;
	padding: string;
	textOverflow: string;
	sortingHighlightColor: string;
	verticalBorderColor: string;
}

// possible theme types needed
//  {
// 		disabledBackground: string;
// 		disabledFontColor: string;
// 		horizontalBorderColor: string;
// 		hoverBackground: string;
// 		hoverFontColor: string;
// 		verticalBorderColor: string;
// 	}

export interface HeaderRowProps extends HeaderGroup<any>, ThemeCommon.CustomCSS {
	hasVisibleRows?: boolean;
	theme?: RecursivePartial<HeaderRowThemeProps>;
}
