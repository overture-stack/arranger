import type { Cell, Column, Header, RowSelectionState } from '@tanstack/react-table';
import type { Dispatch, ReactNode, SetStateAction } from 'react';

import type {
	ColumnMappingInterface,
	ColumnSortingInterface,
	DisplayType,
	FetchDataFn,
	SQONType,
} from '#DataContext/types.js';
import type { DropDownThemeProps } from '#DropDown/types.js';
import type { ThemeCommon } from '#ThemeContext/types/index.js';
import type { RecursivePartial } from '#utils/types.js';

import type { ColumnSelectButtonThemeProps } from './ColumnsSelectButton/types.js';
import type { CountDisplayThemeProps } from './CountDisplay/types.js';
import type { DownloadButtonThemeProps } from './DownloadButton/types.js';
import type { HeaderRowThemeProps } from './HeaderRow/type.js';
import type { MaxRowsSelectorThemeProps } from './MaxRowsSelector/types.js';
import type { PageSelectorThemeProps } from './PageSelector/types.js';
import type { PaginationThemeProps } from './Pagination/types.js';
import type { CellThemeProps, RowThemeProps } from './Row/types.js';
import type { ToolbarThemeProps } from './Toolbar/types.js';

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
	maxPages: number;
	maxResultsWindow: number;
	missingProvider?: string | false;
	pageSize: number;
	rowIdFieldName: string;
	selectedRows: string[];
	selectedRowsDict: RowSelectionState;
	setCurrentColumnsDict: Dispatch<SetStateAction<ColumnsDictionary>>;
	setCurrentPage: Dispatch<SetStateAction<number>>;
	setPageSize: Dispatch<SetStateAction<number>>;
	setSelectedRowsDict: Dispatch<SetStateAction<RowSelectionState>>;
	setSorting: Dispatch<React.SetStateAction<ColumnSortingInterface[]>>;
	sorting: ColumnSortingInterface[];
	sqon: SQONType;
	tableData: unknown[] | [];
	total: number;
	totalPages: number;
	visibleColumnsDict: ColumnsDictionary;
}

export interface TableContextProviderProps {
	children?: React.ReactNode;
	columns?: ColumnMappingInterface[];
	customFetcher?: FetchDataFn;
	documentType?: string;
	fetchRetryLimit?: number;
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

type TableCellComponent = ((cell: TableCellProps) => ReactNode) | ReactNode;

export type TableHeaderProps = Header<any, string> & ColumnMappingInterface & { disabled?: boolean };

type TableHeaderComponent = ((header: TableHeaderProps) => ReactNode) | ReactNode;

// since fieldname alone resolves ColumnType as a flat "string", this "& {}" helps disambiguate the literals
export type ColumnType = DisplayType | (FieldList[number] & {});

export const ColumnListStyles = {
	NONE: 'none',
	COMMAS: 'commas',
	LETTERS: 'letters',
	NUMBERS: 'numbers',
	ROMAN: 'roman',
} as const;

export type ColumnListStylesType = typeof ColumnListStyles;
export type UnorderedListStyles = `${ColumnListStylesType[keyof ColumnListStylesType]}`;

export type ColumnTypesObject = Record<
	ColumnType,
	{
		cellValue: TableCellComponent;
		headerValue: TableHeaderComponent;
		initialWidth: number | string;
		listStyle: UnorderedListStyles;
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
	noColumnsMessage?: ReactNode;
	noDataMessage?: ReactNode;

	// Child components
	Cell: CellThemeProps;
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
	TableWrapper: { width?: string } & ThemeCommon.BoxModelProperties & ThemeCommon.CustomCSS;
	Toolbar: ToolbarThemeProps;
}

export interface TableProps {
	className?: string;
	disableRowSelection?: boolean;
	theme?: RecursivePartial<TableThemeProps>;
}

export interface UseTableDataProps extends RecursivePartial<TableContextThemeProps> {
	visibleTableWidth: number;
}

export type * from './ColumnsSelectButton/types.js';
export type * from './CountDisplay/types.js';
export type * from './DownloadButton/types.js';
export type * from './HeaderRow/type.js';
export type * from './MaxRowsSelector/types.js';
export type * from './PageSelector/types.js';
export type * from './Pagination/types.js';
export type * from './Toolbar/types.js';
