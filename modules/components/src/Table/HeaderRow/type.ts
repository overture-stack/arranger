import type { HeaderGroup } from '@tanstack/react-table';

import type { TableInnerBoxModelProperties } from '#Table/types.js';
import type { ThemeCommon } from '#ThemeContext/types/index.js';
import type { RecursivePartial } from '#utils/types.js';

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
