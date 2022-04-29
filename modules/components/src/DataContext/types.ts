import { Dispatch, SetStateAction } from 'react';
import { Method } from 'axios';
import SQON from 'sqon-builder';

// TODO: This legacyProps import will fail when <Arranger /> is deprecated
// Should be safe to remove afterwards, if the migration path worked out
import { legacyProps } from '@/Arranger/Arranger';
import { CustomThemeType, BaseThemeInterface } from '@/ThemeContext/types';

export interface ColumnMappingInterface {
  accessor?: string;
  canChangeShow: boolean;
  displayValues?: Record<string, string>;
  field: string;
  header?: string;
  id?: string | null;
  isArray?: boolean;
  jsonPath?: string | null;
  query?: string | null;
  show: boolean;
  sortable: boolean;
  type: string;
}

export interface ColumnsStateInterface {
  type: string;
  keyField: string;
  defaultSorted: {
    id: string;
    desc: boolean;
  };
  columns: ColumnMappingInterface[];
}

export interface ExtendedMappingInterface {
  active: boolean; // *
  displayName: string;
  displayType: string;
  displayValues: Record<string, string>;
  field: string;
  isArray: boolean;
  primaryKey: boolean;
  quickSearchEnabled: boolean;
  rangeStep: number | null | undefined;
  type: string;
  unit: string | null;
}

export interface ConfigsInterface {
  columnsState: ColumnsStateInterface;
  extendedMapping: ExtendedMappingInterface[];
}

export type APIFetcherFn = (options: {
  body: any;
  endpoint?: string;
  headers?: Record<string, string>;
  method?: Method;
  url?: string;
}) => Promise<any>;

export type FetchDataFn = (options?: {
  config?: Record<string, any>;
  endpoint?: string;
  first?: any;
  offset?: any;
  sort?: any;
  sqon?: any;
  queryName?: string;
}) => Promise<{ total?: number; data?: any } | void>;

export interface DataProviderProps<Theme = BaseThemeInterface> {
  children?: React.ReactNode;
  configs?: ConfigsInterface;
  customFetcher?: APIFetcherFn;
  documentType: string;
  legacyProps?: typeof legacyProps; // TODO: deprecate along with <Arranger/>
  url?: string;
  theme?: CustomThemeType<Theme>;
}

export type SQONType = typeof SQON | null;

export interface DataContextInterface {
  columnsState: ColumnsStateInterface;
  documentType: string;
  extendedMapping: ExtendedMappingInterface[];
  fetchData: FetchDataFn;
  isLoadingConfigs: boolean;
  providerMissing?: boolean;
  sqon: SQONType;
  setSQON: Dispatch<SetStateAction<SQONType>>;
}

export interface UseDataContextProps {
  callerName?: string;
  customFetcher?: FetchDataFn;
}
