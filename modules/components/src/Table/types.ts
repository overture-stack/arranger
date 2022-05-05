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

import { DownloadButtonThemeProps } from './DownloadButton/types';
import { TableToolbarThemeProps } from './Toolbar/types';
import { ColumnSelectButtonThemeProps } from './ColumnsSelectButton/types';

export type FieldList = ColumnMappingInterface['field'][];

/** TableContext types */
export type ColumnsDictionary = Record<FieldList[number], ColumnMappingInterface>;

export interface TableContextInterface {
  allColumnsDict: ColumnsDictionary;
  currentColumnsDict: ColumnsDictionary;
  currentPage: number;
  documentType: string;
  hasSelectedRows: boolean;
  hasShowableColumns: boolean;
  hasVisibleColumns: boolean;
  isLoading: boolean;
  fetchData: FetchDataFn;
  keyField: string;
  pageSize: number;
  missingProvider?: string | false;
  selectedRows: string[];
  selectedRowsDict: RowSelectionState;
  setCurrentColumnsDict: Dispatch<SetStateAction<ColumnsDictionary>>;
  setCurrentPage: Dispatch<SetStateAction<number>>;
  setPageSize: Dispatch<SetStateAction<number>>;
  setSelectedRowsDict: Dispatch<SetStateAction<RowSelectionState>>;
  sqon: SQONType;
  tableData: unknown[];
  total: number;
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

type TableBoxModelProperties = Omit<ThemeCommon.NonButtonThemeProps, 'flex'> &
  ThemeCommon.CustomCSS;

type TableInnerBoxModelProperties = Omit<TableBoxModelProperties, 'margin'>;

/** Table Component types */
export type TableCellProps = Cell<any> & {
  column: Column<any> & ColumnMappingInterface;
  value: any;
};

type TableCellComponent = ReactNode | ((cell: TableCellProps) => ReactNode);

export type TableHeaderProps = Header<any> & ColumnMappingInterface & { disabled?: boolean };

type TableHeaderComponent = ReactNode | ((header: TableHeaderProps) => ReactNode);

export type ColumnType = 'all' | DisplayType | FieldList[number];

export type ColumnTypesObject = Record<
  ColumnType,
  {
    cellValue: TableCellComponent;
    headerValue: TableHeaderComponent;
    initialWidth: number | string;
    maxWidth: number | string;
    minWidth: number | string;
    resizable: boolean;
    sortable: boolean;
    // sortFn:
  }
>;

export interface TableThemeProps
  extends ThemeCommon.FontProperties,
    Omit<TableBoxModelProperties, 'borderRadius'> {
  columnTypes: ColumnTypesObject;
  defaultSort: ColumnSortingInterface[];
  hideLoader: boolean;
  noColumnsMessage?: ThemeCommon.ChildrenType;
  noDataMessage?: ThemeCommon.ChildrenType;

  // Child components
  ColumnSelectButton: ColumnSelectButtonThemeProps;
  DownloadButton: DownloadButtonThemeProps;
  DropDown: DropDownThemeProps;
  HeaderGroup: Omit<TableInnerBoxModelProperties, 'borderRadius' | 'padding'>;
  HeaderRow: TableInnerBoxModelProperties &
    ThemeCommon.FontProperties & {
      disabledBackground: string;
      disabledFontColor: string;
      horizontalBorderColor: string;
      hoverBackground: string;
      hoverFontColor: string;
      verticalBorderColor: string;
    };
  Row: TableInnerBoxModelProperties &
    ThemeCommon.FontProperties & {
      horizontalBorderColor: string;
      hoverBackground: string;
      hoverFontColor: string;
      selectedBackground: string;
      verticalBorderColor: string;
    };
  TableBody: Omit<TableInnerBoxModelProperties, 'borderRadius' | 'padding'>;
  TableToolbar: TableToolbarThemeProps;
  TableWrapper: ThemeCommon.BoxModelProperties & ThemeCommon.CustomCSS & { width?: string };
}

export interface TableProps {
  disableRowSelection?: boolean;
  hideWarning?: boolean;
  theme?: Partial<TableThemeProps>;
}

export interface UseTableDataProps {
  columnTypes?: ColumnTypesObject;
  disableRowSelection?: boolean;
}

export * from './ColumnsSelectButton/types';
export * from './Counter/types';
export * from './DownloadButton/types';
