import { Dispatch, SetStateAction } from 'react';

import { ColumnMappingInterface, FetchDataFn } from '@/DataContext/types';
import { ThemeCommon } from '@/ThemeContext/types';

export type FieldList = ColumnMappingInterface['field'][];

/** TableContext types */
export type ColumnsDictionary = Record<FieldList[number], ColumnMappingInterface>;

export interface TableContextInterface {
  isLoading: boolean;
  fetchData: FetchDataFn;
  providerMissing?: boolean;
  selectedTableRows: string[];
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

type TableBoxModelProperties = Omit<ThemeCommon.NonButtonThemeProps, 'flex'>;

/** Table types */
export interface TableThemeProps extends TableBoxModelProperties, ThemeCommon.FontProperties {
  HeaderRow: TableBoxModelProperties;
  TableWrapper: ThemeCommon.BoxModelProperties & ThemeCommon.CustomCSS;
}

export interface TableProps {
  hideWarning?: boolean;
  theme?: TableThemeProps;
}

