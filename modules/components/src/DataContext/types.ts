import { Dispatch, SetStateAction } from 'react';
import { Method } from 'axios';
import SQON from 'sqon-builder';

// TODO: This legacyProps import will fail when <Arranger /> is deprecated
// Should be safe to remove afterwards, if the migration path worked out
import { legacyProps } from '@/Arranger/Arranger';
import { CustomThemeType, BaseThemeInterface } from '@/ThemeContext/types';

export type APIFetcherFn = (options: {
  body: any;
  endpoint?: string;
  headers?: Record<string, string>;
  method?: Method;
  url?: string;
}) => Promise<any>;

export interface DataProviderProps<Theme = BaseThemeInterface> {
  children?: React.ReactNode;
  customFetcher?: APIFetcherFn;
  graphqlField: string;
  legacyProps?: typeof legacyProps; // TODO: deprecate along with <Arranger/>
  url?: string;
  theme?: CustomThemeType<Theme>;
}

export interface ExtendedMappingInterface {
  active: boolean;
  displayName: string;
  displayValues: Record<string, string>;
  field: string;
  isArray: boolean;
  primaryKey: boolean;
  quickSearchEnabled: boolean;
  rangeStep: number | null | undefined;
  type: string;
  unit: string | null;
}

export type FetchDataFn = (options?: {
  config?: Record<string, any>;
  sqon?: any;
  queryName?: string;
  sort?: any;
  offset?: any;
  first?: any;
}) => Promise<{ total?: number; data?: any }> | Error | void;

export type SQONType = typeof SQON | null;

export interface DataContextInterface {
  extendedMapping: ExtendedMappingInterface[];
  fetchData: FetchDataFn;
  selectedTableRows: string[];
  setSelectedTableRows: Dispatch<SetStateAction<string[]>>;
  sqon: SQONType;
  setSQON: Dispatch<SetStateAction<SQONType>>;
}

export interface UseDataContextProps {
  customFetcher?: FetchDataFn;
}
