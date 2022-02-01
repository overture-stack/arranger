import { Dispatch } from 'react';
import { Method } from 'axios';
import SQON from 'sqon-builder';

export type APIFetcherFn = (options: {
  body: any;
  endpoint?: string;
  headers?: Record<string, string>;
  method?: Method;
  url?: string;
}) => Promise<any>;

export type FetchDataFn = (options?: {
  config?: Record<string, any>;
  sqon?: any;
  queryName?: string;
  sort?: any;
  offset?: any;
  first?: any;
}) => Promise<{ total?: number; data?: any }> | Error | void;

export type SQONType = typeof SQON | null;

export interface ContextInterface {
  fetchData: FetchDataFn;
  sqon: SQONType;
  setSQON: Dispatch<React.SetStateAction<SQONType>>;
}

export type UseArrangerContextFn = (options?: { customFetcher?: FetchDataFn }) => ContextInterface;
