import type { Row } from '@tanstack/react-table';
import type { PropsWithChildren } from 'react';

import type { FieldList, TableInnerBoxModelProperties } from '#Table/types.js';
import type { ThemeCommon } from '#ThemeContext/types/index.js';
import type { RecursivePartial } from '#utils/types.js';

export interface CellThemeProps extends TableInnerBoxModelProperties {
	horizontalBorderColor: string;
	hoverBackground: string;
	hoverBorderColor: string;
	hoverFontColor: string;
	hoverHorizontalBorderColor: string;
	hoverVerticalBorderColor: string;
	textOverflow: string;
	verticalBorderColor: string;
}

export interface CellProps extends PropsWithChildren, ThemeCommon.CustomCSS {
	accessor?: FieldList[number];
	colSpan?: number;
	size?: string;
	theme?: RecursivePartial<CellThemeProps>;
	value?: string;
}

export interface RowThemeProps extends TableInnerBoxModelProperties {
	horizontalBorderColor: string;
	hoverBackground: string;
	hoverBorderColor: string;
	hoverFontColor: string;
	hoverHorizontalBorderColor: string;
	hoverVerticalBorderColor: string;
	selectedBackground: string;
	textOverflow: string;
	verticalBorderColor: string;
}

export interface RowProps extends Partial<Row<unknown>>, ThemeCommon.CustomCSS {
	id?: string;
	theme?: RecursivePartial<RowThemeProps>;
}
