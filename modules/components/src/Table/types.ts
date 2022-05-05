import { Dispatch, ReactNode, SetStateAction } from 'react';
import { Header, Row } from '@tanstack/react-table';

import { ColumnMappingInterface, DisplayType, FetchDataFn } from '@/DataContext/types';
import { ThemeCommon } from '@/ThemeContext/types';

export type FieldList = ColumnMappingInterface['field'][];

/** TableContext types */
export type ColumnsDictionary = Record<FieldList[number], ColumnMappingInterface>;

export interface TableContextInterface {
  currentPage: number;
  documentType: string;
  isLoading: boolean;
  fetchData: FetchDataFn;
  pageSize: number;
  providerMissing?: boolean;
  selectedTableRows: string[];
  setCurrentPage: Dispatch<SetStateAction<number>>;
  setPageSize: Dispatch<SetStateAction<number>>;
  setSelectedTableRows: Dispatch<SetStateAction<string[]>>;
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
export interface TableThemeProps extends TableBoxModelProperties, ThemeCommon.FontProperties {
  HeaderGroup: Omit<TableInnerBoxModelProperties, 'padding'>;
  HeaderRow: TableInnerBoxModelProperties & ThemeCommon.FontProperties;
  Row: TableInnerBoxModelProperties & ThemeCommon.FontProperties;
  TableBody: Omit<TableInnerBoxModelProperties, 'padding'>;
  TableWrapper: ThemeCommon.BoxModelProperties & ThemeCommon.CustomCSS;
}

type TableCellComponent =
  | ReactNode
  | ((cell: ColumnMappingInterface & Row<any> & { value: any }) => ReactNode);

export type TableCellTypes = Record<'all' | DisplayType | FieldList[number], TableCellComponent>;

type TableHeaderComponent =
  | ReactNode
  | ((header: ColumnMappingInterface & Header<any>) => ReactNode);

export type TableHeaderTypes = Record<
  'all' | DisplayType | FieldList[number],
  TableHeaderComponent
>;

export interface TableProps {
  customCells?: Partial<TableCellTypes>;
  customHeaders?: Partial<TableHeaderTypes>;
  hideWarning?: boolean;
  theme?: TableThemeProps;
}

export interface UseTableDataProps {
  customCells?: Partial<TableCellTypes>;
  customHeaders?: Partial<TableHeaderTypes>;
}
