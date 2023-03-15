import { PropsWithChildren } from 'react';
import { Row } from '@tanstack/react-table';

import { FieldList, TableInnerBoxModelProperties } from '@/Table/types';
import { ThemeCommon } from '@/ThemeContext/types';

export interface CellThemeProps {
	columnWidth: string;
	hoverVerticalBorderColor: string;
	padding: string;
	textOverflow: string;
	verticalBorderColor: string;
}

export interface CellProps extends PropsWithChildren, ThemeCommon.CustomCSS {
	accessor?: FieldList[number];
	colSpan?: number;
	theme?: Partial<CellThemeProps>;
	value?: string;
}

export interface RowThemeProps extends TableInnerBoxModelProperties {
	columnWidth: string;
	horizontalBorderColor: string;
	hoverBackground: string;
	hoverFontColor: string;
	hoverVerticalBorderColor: string;
	padding: string;
	selectedBackground: string;
	textOverflow: string;
	verticalBorderColor: string;
}

export interface RowProps extends Partial<Row<unknown>>, ThemeCommon.CustomCSS {
	id?: string;
	theme?: Partial<RowThemeProps>;
}
