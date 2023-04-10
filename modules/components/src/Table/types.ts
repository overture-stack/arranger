import { Dispatch, ReactNode, SetStateAction } from 'react';
import { Cell, Column, Header, RowSelectionState } from '@tanstack/react-table';

import {
	ColumnMappingInterface,
	ColumnSortingInterface,
	DisplayType,
	FetchDataFn,
	SQONType,
} from '@/DataContext/types';
import { DropDownThemeProps } from '@/DropDown/types';
import { ThemeCommon } from '@/ThemeContext/types';

import { ColumnSelectButtonThemeProps } from './ColumnsSelectButton/types';
import { CountDisplayThemeProps } from './CountDisplay/types';
import { DownloadButtonThemeProps } from './DownloadButton/types';
import { MaxRowsSelectorThemeProps } from './MaxRowsSelector/types';
import { PageSelectorThemeProps } from './PageSelector/types';
import { PaginationThemeProps } from './Pagination/types';
import { ToolbarThemeProps } from './Toolbar/types';
import { HeaderRowThemeProps } from './HeaderRow/type';
import { RowThemeProps } from './Row/types';

export type FieldList = ColumnMappingInterface['fieldName'][];

/** TableContext types */
export type ColumnsDictionary = Record<FieldList[number], ColumnMappingInterface>;
export const SELECTION_COLUMN_ID = 'select';

export interface TableContextInterface {
	allColumnsDict: ColumnsDictionary;
	currentColumnsDict: ColumnsDictionary;
	currentPage: number;
	defaultSorting: ColumnSortingInterface[];
	documentType: string;
	fetchData: FetchDataFn;
	hasSelectedRows: boolean;
	hasShowableColumns: boolean;
	hasVisibleColumns: boolean;
	isLoading: boolean;
	keyFieldName: string;
	maxPages: number;
	maxResultsWindow: number;
	missingProvider?: string | false;
	pageSize: number;
	selectedRows: string[];
	selectedRowsDict: RowSelectionState;
	setCurrentColumnsDict: Dispatch<SetStateAction<ColumnsDictionary>>;
	setCurrentPage: Dispatch<SetStateAction<number>>;
	setPageSize: Dispatch<SetStateAction<number>>;
	setSelectedRowsDict: Dispatch<SetStateAction<RowSelectionState>>;
	setSorting: Dispatch<React.SetStateAction<ColumnSortingInterface[]>>;
	sorting: ColumnSortingInterface[];
	sqon: SQONType;
	tableData: unknown[];
	total: number;
	totalPages: number;
	visibleColumnsDict: ColumnsDictionary;
}

export interface TableContextProviderProps {
	children?: React.ReactNode;
	columns?: ColumnMappingInterface[];
	customFetcher?: FetchDataFn;
	documentType?: string;
}

export interface UseTableContextProps {
	callerName?: string;
	customFetcher?: FetchDataFn;
}

type TableBoxModelProperties = Omit<ThemeCommon.NonButtonThemeProps, 'flex'>;

export type TableInnerBoxModelProperties = Omit<TableBoxModelProperties, 'margin'>;

/** Table Component types */
export type TableCellProps = Cell<any, string> & {
	column: Column<any> & ColumnMappingInterface;
	value: any;
};

type TableCellComponent = ReactNode | ((cell: TableCellProps) => ReactNode);

export type TableHeaderProps = Header<any, string> &
	ColumnMappingInterface & { disabled?: boolean };

type TableHeaderComponent = ReactNode | ((header: TableHeaderProps) => ReactNode);

export type ColumnType = 'all' | DisplayType | FieldList[number];

export enum ColumnListStyles {
	NONE = 'none',
	COMMAS = 'commas',
	LETTERS = 'letters',
	NUMBERS = 'numbers',
	ROMAN = 'roman',
}

export type ColumnTypesObject = Record<
	ColumnType,
	{
		cellValue: TableCellComponent;
		headerValue: TableHeaderComponent;
		initialWidth: number | string;
		listStyle: `${ColumnListStyles}`;
		maxWidth: number | string;
		minWidth: number | string;
		resizable: boolean;
		size: number;
		sortable: boolean;
		// sortFn:
	}
>;

interface TableContextThemeProps {
	columnTypes: ColumnTypesObject;
	defaultColumnWidth: number;
	disableColumnResizing: boolean;
	disableRowSelection: boolean;
	disableRowSorting: boolean;
}

export interface TableThemeProps
	extends TableContextThemeProps,
		ThemeCommon.FontProperties,
		Omit<TableBoxModelProperties, 'borderRadius'> {
	defaultSort: ColumnSortingInterface[];
	hideLoader: boolean;
	noColumnsMessage?: ThemeCommon.ChildrenType;
	noDataMessage?: ThemeCommon.ChildrenType;

	// Child components
	ColumnSelectButton: ColumnSelectButtonThemeProps;
	CountDisplay: CountDisplayThemeProps;
	DownloadButton: DownloadButtonThemeProps;
	DropDown: DropDownThemeProps;
	HeaderGroup: Omit<TableInnerBoxModelProperties, 'borderRadius' | 'padding'>;
	HeaderRow: HeaderRowThemeProps;
	MaxRowsSelector: MaxRowsSelectorThemeProps;
	PageSelector: PageSelectorThemeProps;
	Pagination: PaginationThemeProps;
	Row: RowThemeProps;
	TableBody: Omit<TableInnerBoxModelProperties, 'borderRadius' | 'padding'>;
	TableWrapper: ThemeCommon.BoxModelProperties & ThemeCommon.CustomCSS & { width?: string };
	Toolbar: ToolbarThemeProps;
}

export interface TableProps {
	className?: string;
	disableRowSelection?: boolean;
	theme?: Partial<TableThemeProps>;
}

export interface UseTableDataProps extends Partial<TableContextThemeProps> {
	visibleTableWidth: number;
}

export * from './ColumnsSelectButton/types';
export * from './CountDisplay/types';
export * from './DownloadButton/types';
