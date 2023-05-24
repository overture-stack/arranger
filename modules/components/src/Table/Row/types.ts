import { PropsWithChildren } from 'react';
import { Row } from '@tanstack/react-table';

import { FieldList, TableInnerBoxModelProperties } from '@/Table/types';
import { ThemeCommon } from '@/ThemeContext/types';
import { RecursivePartial } from '@/utils/types';

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
