import { Dispatch } from 'react';
import { Method } from 'axios';
import SQON from 'sqon-builder';

import { CustomThemeType, DefaultTheme } from '@/ThemeProvider';

export type APIFetcherFn = (options: {
  body: any;
  endpoint?: string;
  headers?: Record<string, string>;
  method?: Method;
  url?: string;
}) => Promise<any>;

export interface DataProviderProps<Theme = DefaultTheme> {
  children?: React.ReactNode;
  customFetcher?: APIFetcherFn;
  url?: string;
  theme?: CustomThemeType<Theme>;
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
  fetchData: FetchDataFn;
  sqon: SQONType;
  setSQON: Dispatch<React.SetStateAction<SQONType>>;
}

export interface UseDataContextProps {
  customFetcher?: FetchDataFn;
}
